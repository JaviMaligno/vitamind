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
    return () => clearInterval(id);
  }, [lat, lon]);
  return phase;
}
