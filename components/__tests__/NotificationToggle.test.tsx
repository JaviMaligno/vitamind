import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (k: string) => `${ns}.${k}`,
  useLocale: () => "es",
}));
vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ platform: "native", isInAppBrowser: false, openModal: vi.fn(), trigger: vi.fn() }),
}));

import NotificationToggle from "@/components/NotificationToggle";

// jsdom has no PushManager, so the component renders its "unsupported" text.
// That path does not exercise the labels, so to test the labels we force the
// supported+off path by stubbing the push APIs.
function stubPushSupported(subscribed = false) {
  const g = globalThis as Record<string, unknown>;
  g.PushManager = function () {};
  const sub = subscribed ? { endpoint: "x", unsubscribe: vi.fn() } : null;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(sub) } }) },
  });
  g.Notification = { permission: "default" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationToggle labels", () => {
  it("uses the generic notifications-namespace text when no labels are passed", async () => {
    stubPushSupported(false);
    render(<NotificationToggle lat={40} lon={-3} tz={1} skinType={3} areaFraction={0.25} cityName="Madrid" />);
    // notifications.notify is the off-state key; the mock returns "notifications.notify".
    expect(await screen.findByText(/notifications\.notify/)).toBeTruthy();
  });

  it("uses the city-framed labelOff when provided", async () => {
    stubPushSupported(false);
    render(
      <NotificationToggle
        lat={40} lon={-3} tz={1} skinType={3} areaFraction={0.25} cityName="Madrid"
        labelOff="🔔 Avísame" labelOn="🔔 Suscrito"
      />,
    );
    expect(await screen.findByText("🔔 Avísame")).toBeTruthy();
    expect(screen.queryByText(/notifications\.notify/)).toBeNull();
  });
});

/**
 * iOS Safari, outside standalone. Web push exists on iOS only for a web app on
 * the home screen: in a Safari TAB the service worker registration has no
 * `pushManager` at all, while `PushManager` is still on `window` — so the
 * support check passes and the old code then read `.getSubscription()` off
 * `undefined`. The rejection was unhandled, no `setStatus` ever ran, and the
 * toggle stayed on "loading" for the rest of the visit with nothing the user
 * could do about it. UNVERIFIED ON A REAL iPHONE (see the branch notes); this
 * test pins the shape of the guard, not Safari's behaviour.
 */
describe("NotificationToggle on a registration without pushManager", () => {
  it("says unsupported instead of hanging on 'loading'", async () => {
    const g = globalThis as Record<string, unknown>;
    g.PushManager = function () {};
    g.Notification = { permission: "default" };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });
    render(<NotificationToggle lat={40} lon={-3} tz={1} skinType={3} areaFraction={0.25} cityName="Madrid" />);
    expect(await screen.findByText(/notifications\.unsupported/)).toBeTruthy();
  });
});
