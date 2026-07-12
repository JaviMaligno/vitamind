"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { SolarPhase } from "@/lib/solar-phase";

type Theme = "auto" | "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  cycle: () => void;
  autoPhase: SolarPhase | null;
  setAutoPhase: (p: SolarPhase) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function getStored(): Theme {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem("vitamind:theme");
  return v === "light" || v === "dark" ? v : "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from "auto" on both server and first client render so hydration
  // matches; the stored preference is applied after mount (below).
  const [theme, setThemeState] = useState<Theme>("auto");
  const [autoPhase, setAutoPhase] = useState<SolarPhase | null>(null);

  useEffect(() => {
    const stored = getStored();
    if (stored !== "auto") setThemeState(stored);
  }, []);

  const resolved: "light" | "dark" =
    theme === "light" ? "light"
    : theme === "dark" ? "dark"
    : autoPhase === "night" || autoPhase === "dusk" ? "dark" : "light";

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("vitamind:theme", t);
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === "auto" ? "light" : theme === "light" ? "dark" : "auto");
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, cycle, autoPhase, setAutoPhase }}>
      {children}
    </ThemeContext.Provider>
  );
}
