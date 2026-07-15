import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

/** Botón canónico. Tap-target ≥44px. primary = acento sol lleno; secondary = glass. */
export default function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: Variant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-body font-semibold transition-colors cursor-pointer";
  const skin =
    variant === "primary"
      ? "bg-sun text-white hover:bg-sun-strong"
      : "bg-glass border border-glass-border text-text-primary hover:bg-surface-elevated";
  return <button className={`${base} ${skin} ${className}`} {...rest}>{children}</button>;
}
