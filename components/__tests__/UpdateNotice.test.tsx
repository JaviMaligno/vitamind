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
//   MessageChannel           (paired ports for the GET_VERSION handshake)

class FakePort {
  other!: FakePort;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage(data: unknown) {
    queueMicrotask(() => this.other.onmessage?.({ data }));
  }
}

class FakeMessageChannel {
  port1 = new FakePort();
  port2 = new FakePort();
  constructor() {
    this.port1.other = this.port2;
    this.port2.other = this.port1;
  }
}

class FakeWorker extends EventTarget {
  state: string;
  // The build version this fake sw.js reports via the GET_VERSION handshake;
  // null simulates a pre-handshake worker that never answers.
  version: string | null;
  postMessage = vi.fn((data: unknown, ports?: FakePort[]) => {
    const msg = data as { type?: string } | null;
    if (msg?.type === "GET_VERSION" && ports?.[0] && this.version !== null) {
      ports[0].postMessage({ version: this.version });
    }
  });
  constructor(state = "installing", version: string | null = "sw-build") {
    super();
    this.state = state;
    this.version = version;
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
  // jsdom has no MessageChannel; the handshake tests need the paired-port fake.
  vi.stubGlobal("MessageChannel", FakeMessageChannel);
  reloadSpy = vi.fn();
  originalLocation = window.location;
  // jsdom's location.reload throws "Not implemented"; swap the whole object.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

async function flush() {
  // Let the register() promise .then(), the GET_VERSION handshake microtasks
  // and React commits all run (the setTimeout(0) drains queued microtasks).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
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

describe("UpdateNotice — build-version handshake", () => {
  // Pages are network-first, so a page that was just (re)loaded online is
  // often the same build as the waiting SW. The notice must only appear when
  // the running page is actually stale.

  it("activates silently (no notice, no reload) when the waiting SW is the same build as the page", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_VERSION", "abc12345");
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    worker.version = "abc12345";
    await act(async () => {
      worker.setState("installed");
    });
    await flush();

    expect(screen.queryByText("update.available")).toBeNull();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    // The silent activation's controllerchange must NOT reload — the page
    // already runs this build.
    await act(async () => {
      container.dispatchEvent(new Event("controllerchange"));
    });
    expect(reloadSpy).not.toHaveBeenCalled();

    // ...but a later controllerchange (a genuinely new SW taking over, e.g.
    // triggered from another tab) still reloads.
    await act(async () => {
      container.dispatchEvent(new Event("controllerchange"));
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the notice when the waiting SW is a different build than the page", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_VERSION", "abc12345");
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    worker.version = "def67890";
    await act(async () => {
      worker.setState("installed");
    });
    await flush();

    expect(await screen.findByText("update.available")).toBeTruthy();
    // No silent activation: taking over must stay a user decision here.
    expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("falls back to the notice when the waiting SW never answers GET_VERSION", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_VERSION", "abc12345");
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    worker.version = null; // pre-handshake worker: ignores GET_VERSION
    await act(async () => {
      worker.setState("installed");
    });

    // The 1s handshake timeout must elapse before the fallback fires.
    expect(await screen.findByText("update.available", {}, { timeout: 2500 })).toBeTruthy();
    expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("skips the handshake and shows the notice when the page has no build version", async () => {
    // A page built before this handshake existed is stale by definition.
    vi.stubEnv("NEXT_PUBLIC_BUILD_VERSION", "");
    installSWContainer({ id: "old-controller" });
    render(<UpdateNotice />);
    await flush();

    const worker = registration.pushUpdate();
    worker.version = "abc12345";
    await act(async () => {
      worker.setState("installed");
    });

    expect(await screen.findByText("update.available")).toBeTruthy();
    expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "GET_VERSION" }, expect.anything());
  });
});
