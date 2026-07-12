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

/** Mapea una fase a los tokens CSS de gradiente y al tema resuelto que le pega. */
export const PHASE_STYLE: Record<SolarPhase, { grad: string; theme: "light" | "dark" }> = {
  dawn: { grad: "var(--grad-dawn)", theme: "light" },
  day: { grad: "var(--grad-day)", theme: "light" },
  dusk: { grad: "var(--grad-dusk)", theme: "dark" },
  night: { grad: "var(--grad-night)", theme: "dark" },
};
