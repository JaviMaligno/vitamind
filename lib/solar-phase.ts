/** Fase solar del cielo, para elegir el gradiente de fondo. */
export type SolarPhase = "night" | "dawn" | "day" | "dusk";

/**
 * Mapea la elevación solar (grados) y si el sol sube o baja a una fase.
 * <-6° = noche; -6°..+8° = crepúsculo (dawn si sube, dusk si baja); >8° = día.
 */
export function solarPhase(elevationDeg: number, rising: boolean): SolarPhase {
  if (elevationDeg < -6) return "night";
  if (elevationDeg > 8) return "day";
  return rising ? "dawn" : "dusk";
}

/**
 * Mapea una fase a: `grad` (gradiente vibrante del hero/acentos), `page` (tinte
 * suave del fondo de página) y `theme` (tokens de texto). Solo la noche es tema
 * oscuro; el atardecer todavía tiene luz, así que es tema claro cálido.
 */
export const PHASE_STYLE: Record<SolarPhase, { grad: string; page: string; window: string; theme: "light" | "dark" }> = {
  dawn: { grad: "var(--grad-dawn)", page: "var(--page-dawn)", window: "var(--window-dawn)", theme: "light" },
  day: { grad: "var(--grad-day)", page: "var(--page-day)", window: "var(--window-day)", theme: "light" },
  dusk: { grad: "var(--grad-dusk)", page: "var(--page-dusk)", window: "var(--window-dusk)", theme: "light" },
  night: { grad: "var(--grad-night)", page: "var(--page-night)", window: "var(--window-night)", theme: "dark" },
};
