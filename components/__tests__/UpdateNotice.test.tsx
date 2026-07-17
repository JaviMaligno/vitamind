import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (k: string) => `${ns}.${k}`,
}));

import UpdateNotice from "@/components/UpdateNotice";

// ---- Fake service-worker harness -------------------------------------------
// Minimal stand-ins that mirror the browser objects UpdateNotice.tsx touches:
//   navigator.serviceWorker  (EventTarget + .controller + .register)
//   ServiceWorkerRegistration (EventTarget + .installing/.waiting)
//   ServiceWorker            (EventTarget + .state + .postMessage)

class FakeWorker extends EventTarget {
  state: string;
  postMessage = vi.fn();
  constructor(state = "installing") {
    super();
    this.state = state;
  }
  // Drive the install lifecycle the way the browser does.
  setState(next: string) {
    this.state = next;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(() => Promise.resolve());
  // Simulate the browser finding a byte-different sw.js (new build SHA):
  // an installing worker appears, then transitions to "installed".
  pushUpdate() {
    const worker = new FakeWorker("installing");
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }
}

let container: EventTarget & {
  controller: unknown;
  register: ReturnType<typeof vi.fn>;
};
let registration: FakeRegistration;
let reloadSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

function installSWContainer(controller: unknown) {
  registration = new FakeRegistration();
  const target = new EventTarget() as typeof container;
  target.controller = controller;
  target.register = vi.fn(() => Promise.resolve(registration));
  container = target;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reloadSpy = vi.fn();
  originalLocation = window.location;
  // jsdom's location.reload throws "Not implemented"; swap the whole object.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

async function flush() {
  // Let the register() promise .then() run and React commit.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("UpdateNotice — when the notice appears", () => {
  it("does NOT appear on a fresh first install (no controller yet)", async () => {
    // controller === null means this tab has no SW controlling it: it's the
    // very first install, not an update. Showing 'reload' here would be wrong.
    installSWContainer(null);
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    await act(async () => {
      worker.setState("installed");
    });

    expect(screen.queryByText("update.available")).toBeNull();
  });

  it("appears when an updated SW installs while a controller is already active", async () => {
    // controller present === the app is already running an old SW; a new,
    // byte-different sw.js (new build SHA) installing is a genuine update.
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    await act(async () => {
      worker.setState("installed");
    });

    expect(await screen.findByText("update.available")).toBeTruthy();
    expect(await screen.findByText("update.reload")).toBeTruthy();
  });

  it("appears immediately if a SW is already waiting from a previous session", async () => {
    installSWContainer({ id: "old-controller" });
    registration.waiting = new FakeWorker("installed");
    render(<UpdateNotice />);
    await flush();

    expect(await screen.findByText("update.available")).toBeTruthy();
  });

  it("does NOT treat a waiting SW as an update when nothing controls the page", async () => {
    // reg.waiting set but no controller → still a first-run scenario.
    installSWContainer(null);
    registration.waiting = new FakeWorker("installed");
    render(<UpdateNotice />);
    await flush();

    expect(screen.queryByText("update.available")).toBeNull();
  });
});

describe("UpdateNotice — clicking Reload actually updates the app", () => {
  it("posts SKIP_WAITING to the waiting worker, then reloads on controllerchange", async () => {
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    await act(async () => {
      worker.setState("installed");
    });

    const button = await screen.findByText("update.reload");

    // 1. Tapping Reload must tell the waiting SW to take over.
    await act(async () => {
      fireEvent.click(button);
    });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    // Reload must NOT happen until the new SW actually takes control.
    expect(reloadSpy).not.toHaveBeenCalled();

    // 2. New SW activates → browser fires controllerchange → page reloads
    //    onto the new version. This is the step that "updates the app".
    await act(async () => {
      container.dispatchEvent(new Event("controllerchange"));
    });
    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
  });

  it("reloads only once even if controllerchange fires repeatedly", async () => {
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    await act(async () => {
      worker.setState("installed");
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("update.reload"));
    });
    await act(async () => {
      container.dispatchEvent(new Event("controllerchange"));
      container.dispatchEvent(new Event("controllerchange"));
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateNotice — foreground resume checks for a new version", () => {
  it("calls registration.update() when the app becomes visible again", async () => {
    // Warm resume: the app was backgrounded and re-opened without a reload,
    // so nothing else would trigger a SW update check.
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    expect(registration.update).not.toHaveBeenCalled();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("does NOT check while the app is hidden (backgrounded)", async () => {
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(registration.update).not.toHaveBeenCalled();
    } finally {
      delete (document as unknown as { visibilityState?: unknown }).visibilityState;
    }
  });

  it("stops checking after unmount (listener cleaned up)", async () => {
    installSWContainer({ id: "old-controller" });
    const { unmount } = render(<UpdateNotice />);
    await flush();

    unmount();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(registration.update).not.toHaveBeenCalled();
  });
});
