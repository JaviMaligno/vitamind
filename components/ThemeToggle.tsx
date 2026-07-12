"use client";
import { useTheme } from "@/context/ThemeProvider";

export default function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const label = theme === "auto" ? "Tema: automático (sol)" : theme === "light" ? "Tema: claro" : "Tema: oscuro";
  const glyph = theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
  return (
    <button
      onClick={cycle}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-glass border border-glass-border text-text-secondary hover:text-text-primary transition-colors"
      aria-label={label}
      title={label}
      suppressHydrationWarning
    >
      <span aria-hidden className="text-sm" suppressHydrationWarning>{glyph}</span>
    </button>
  );
}
