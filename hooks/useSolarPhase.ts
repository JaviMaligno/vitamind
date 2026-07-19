"use client";
import { useEffect, useState } from "react";
import { solarElev, dayOfYear } from "@/lib/solar";
import { solarPhase, type SolarPhase } from "@/lib/solar-phase";

/** Fase solar actual para una ubicación. `null` hasta el primer cálculo en cliente
 *  (en servidor no se llama; el fallback de fase lo pone quien lo consuma). */
export function useSolarPhase(lat: number, lon: number): SolarPhase | null {
  const [phase, setPhase] = useState<SolarPhase | null>(null);
  useEffect(() => {
    function compute() {
      const now = new Date();
      const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
      const doy = dayOfYear(now);
      const elev = solarElev(lat, lon, doy, utcH);
      const elevPrev = solarElev(lat, lon, doy, utcH - 1 / 6); // 10 min antes
      setPhase(solarPhase(elev, elev >= elevPrev));
    }
    compute();
    const id = setInterval(compute, 5 * 60 * 1000);
    // Los timers se congelan con la PWA en segundo plano: al retomarla horas
    // después, la fase seguiría siendo la de cuando se dejó (cielo de día a
    // las 21:40). Recalcular al volver a ser visible corrige el resume caliente.
    const onVisible = () => {
      if (document.visibilityState === "visible") compute();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lat, lon]);
  return phase;
}
