import type { DayState } from "./data";

export type WidgetTheme = "light" | "dark";

export function resolveWidgetTheme(theme: unknown): WidgetTheme {
  return theme === "dark" ? "dark" : "light";
}

/**
 * One accent per verdict, echoing the app's phase colours: warm amber when the
 * sun is usable, blue while you are waiting, muted once the day is over.
 *
 * The plate stays dark in both themes — the curve is drawn against a night-sky
 * background in the app too, and a light plate would leave the amber unreadable.
 */
const ACCENT: Record<DayState, string> = {
  good_now: "#ffb020",
  upcoming: "#5aa9e6",
  window_closed: "#8b93a7",
  no_synthesis: "#6b7180",
};

export function dayCurvePalette(theme: unknown, state: DayState) {
  const resolved = resolveWidgetTheme(theme);
  return {
    accent: ACCENT[state],
    pageBackground: resolved === "dark"
      ? "var(--color-background-primary, #10131a)"
      : "var(--color-background-primary, #ffffff)",
    textPrimary: resolved === "dark"
      ? "var(--color-text-primary, #f4f5f7)"
      : "var(--color-text-primary, #17191f)",
    textMuted: resolved === "dark"
      ? "var(--color-text-secondary, #a8adb8)"
      : "var(--color-text-secondary, #646b78)",
    plate: "#0a0f28",
    onPlate: "rgba(255,255,255,0.92)",
    onPlateFaint: "rgba(255,255,255,0.55)",
    grid: "rgba(255,255,255,0.14)",
  };
}
