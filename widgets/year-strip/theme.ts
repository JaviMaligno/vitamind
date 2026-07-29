export type WidgetTheme = "light" | "dark";

export function resolveWidgetTheme(theme: unknown): WidgetTheme {
  return theme === "dark" ? "dark" : "light";
}

export function widgetPalette(theme: unknown) {
  const resolved = resolveWidgetTheme(theme);
  return {
    pageBackground: resolved === "dark" ? "var(--color-background-primary, #10131a)" : "var(--color-background-primary, #ffffff)",
    textPrimary: resolved === "dark" ? "var(--color-text-primary, #f4f5f7)" : "var(--color-text-primary, #17191f)",
    textMuted: resolved === "dark" ? "var(--color-text-secondary, #a8adb8)" : "var(--color-text-secondary, #646b78)",
    plate: "#0a0f28",
    onPlateFaint: "rgba(255,255,255,0.55)",
  };
}
