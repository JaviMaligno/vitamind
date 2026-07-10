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
  (globalThis as any).PushManager = function () {};
  const sub = subscribed ? { endpoint: "x", unsubscribe: vi.fn() } : null;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(sub) } }) },
  });
  (globalThis as any).Notification = { permission: "default" };
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
