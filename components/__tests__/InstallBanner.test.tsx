import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * WHAT THIS PINS. The banner used to appear from a bare
 * `setTimeout(…, 10000)`, and that same timer marked the install ask as spent
 * — so the one request a browser ever got was burned ten seconds after landing
 * on a sunrise table, and never offered again. These tests state the rule that
 * replaced it: the ask waits for a signal the visitor gave (a return visit, or
 * an intent interaction), and "seen" is written when the banner is actually on
 * screen.
 */

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const trigger = vi.fn(async () => "manual" as const);
vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({
    platform: "manual",
    isInAppBrowser: false,
    isInstalled: false,
    trigger,
  }),
}));

// PhaseButton reads AppProvider + the solar phase; neither is what this file is
// about, so it is replaced by a plain button.
vi.mock("@/components/PhaseButton", () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import InstallBanner from "@/components/InstallBanner";
import { INSTALL_INTENT_EVENT, getInstallBannerState, signalInstallIntent } from "@/lib/install";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

async function mount() {
  const result = render(<InstallBanner />);
  // Let the mount effect and its queued microtask run.
  await act(async () => { await Promise.resolve(); });
  return result;
}

function shown(container: HTMLElement): boolean {
  return Boolean(container.querySelector(".opacity-100"));
}

describe("InstallBanner — when the ask is spent", () => {
  it("stays quiet on a first visit with no interaction, however long the page is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await mount();
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(shown(container)).toBe(false);
    expect(getInstallBannerState().count).toBe(0);
    vi.useRealTimers();
  });

  it("appears after an intent interaction — the skin selector, a month, the GPS button", async () => {
    const { container } = await mount();
    await act(async () => { signalInstallIntent(); });
    expect(shown(container)).toBe(true);
    expect(getInstallBannerState().count).toBe(1);
  });

  it("appears on the second visit without waiting for an interaction", async () => {
    localStorage.setItem("vitamind:visits", "1");
    const { container } = await mount();
    expect(shown(container)).toBe(true);
  });

  it("marks the ask as spent only when the banner really reaches the screen", async () => {
    await mount();
    expect(getInstallBannerState().shownAt).toBe(0);
    await act(async () => { signalInstallIntent(); });
    expect(getInstallBannerState().shownAt).toBeGreaterThan(0);
  });

  it("records a dismissal, which is what earns the later second ask", async () => {
    const { container, getByLabelText } = await mount();
    await act(async () => { signalInstallIntent(); });
    await act(async () => { getByLabelText("modal.close").click(); });
    expect(getInstallBannerState().outcome).toBe("dismissed");
    expect(container).toBeTruthy();
  });

  it("does not ask again while the cooldown is unspent", async () => {
    localStorage.setItem(
      "vitamind:installBanner",
      JSON.stringify({ shownAt: Date.now(), count: 1, outcome: "dismissed" }),
    );
    const { container } = await mount();
    await act(async () => { window.dispatchEvent(new CustomEvent(INSTALL_INTENT_EVENT)); });
    expect(shown(container)).toBe(false);
  });

  it("never asks again once the app is installed", async () => {
    localStorage.setItem(
      "vitamind:installBanner",
      JSON.stringify({ shownAt: 0, count: 1, outcome: "installed" }),
    );
    const { container } = await mount();
    await act(async () => { signalInstallIntent(); });
    expect(shown(container)).toBe(false);
  });
});
