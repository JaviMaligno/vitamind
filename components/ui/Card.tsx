import type { ReactNode } from "react";

type Variant = "glass" | "window";

/** Superficie del sistema. `glass` = tarjeta clara sobre el fondo (contenido
 *  general). `window` = "ventana al cielo" oscura para visualizaciones de datos. */
export default function Card({
  variant = "glass",
  className = "",
  children,
}: { variant?: Variant; className?: string; children: ReactNode }) {
  const base = "rounded-2xl p-4 shadow-lg";
  const skin =
    variant === "glass"
      ? "bg-glass border border-glass-border backdrop-blur-md text-text-primary"
      : "bg-window border border-window-border text-on-window";
  return <div className={`${base} ${skin} ${className}`}>{children}</div>;
}
