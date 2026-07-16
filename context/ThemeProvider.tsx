"use client";
import { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from "react";
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

// The theme preference lives in localStorage and is exposed through
// useSyncExternalStore: the server (and hydration render) see "auto", and React
// swaps in the stored value right after hydration without a mismatch. This
// replaces the previous useState + set-state-in-effect pattern.
let themeListeners: (() => void)[] = [];

function subscribeTheme(cb: () => void) {
  themeListeners = [...themeListeners, cb];
  return () => {
    themeListeners = themeListeners.filter((l) => l !== cb);
  };
}

function getStored(): Theme {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem("vitamind:theme");
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function setStored(t: Theme) {
  try {
    localStorage.setItem("vitamind:theme", t);
  } catch {
    // Storage unavailable (private mode, quota): theme just won't persist.
  }
  themeListeners.forEach((l) => l());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getStored, (): Theme => "auto");
  const [autoPhase, setAutoPhase] = useState<SolarPhase | null>(null);

  const resolved: "light" | "dark" =
    theme === "light" ? "light"
    : theme === "dark" ? "dark"
    : autoPhase === "night" ? "dark" : "light";

  const setTheme = useCallback((t: Theme) => {
    setStored(t);
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
