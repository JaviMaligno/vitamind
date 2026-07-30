/**
 * The day-curve chart: sampling on the server, geometry shared with the widget.
 *
 * Pure and DOM-free on purpose — the MCP App widget bundles this straight into
 * its iframe, so anything imported here would ship to the client too.
 *
 * This is deliberately NOT `components/DailyCurve.tsx`. That component is a
 * client component with hover readouts, cloud shading and a weather overlay; the
 * widget draws a still picture of the same data at a quarter of the size. Sharing
 * the *rendering* would mean porting all of it into an iframe that has no use for
 * it, so what is shared is the arithmetic: sampling, the plot mapping, and where
 * the viable band starts and ends.
 */
import type { SolarPoint } from "./types";

/**
 * Minutes between chart samples. The solar curve is computed every 5 minutes;
 * that is more resolution than a 200px-tall chart can show, and it triples the
 * payload that rides along in the tool result's `_meta`.
 */
export const DAY_CURVE_STEP_MINUTES = 15;

/** Readings per day, both midnights included. */
export const DAY_CURVE_SAMPLES = (24 * 60) / DAY_CURVE_STEP_MINUTES + 1;

/** One elevation per step, rounded to a tenth of a degree. */
export function sampleElevations(curve: SolarPoint[]): number[] {
  if (curve.length === 0) return [];
  const perStep = Math.max(1, Math.round(DAY_CURVE_STEP_MINUTES / 5));
  const out: number[] = [];
  for (let i = 0; i < curve.length; i += perStep) {
    out.push(Math.round(curve[i].elevation * 10) / 10);
  }
  return out;
}

export interface PlotBox {
  width: number;
  height: number;
  /** Elevation at the bottom edge. */
  min: number;
  /** Elevation at the top edge. */
  max: number;
}

/** SVG path across the plot box, one point per sample. */
export function curvePath(elevations: number[], box: PlotBox): string {
  if (elevations.length === 0) return "";
  const span = box.max - box.min || 1;
  const x = (i: number) => (i / Math.max(1, elevations.length - 1)) * box.width;
  const y = (e: number) => box.height - ((e - box.min) / span) * box.height;
  return elevations
    .map((e, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(e).toFixed(1)}`)
    .join("");
}

export interface ViableBand {
  startHours: number;
  endHours: number;
}

/**
 * The stretch of the day above the synthesis threshold, as local hours.
 *
 * Outermost crossings rather than the first contiguous run: the tool reports a
 * single window, and a curve that dips momentarily mid-window (numerical noise,
 * or a threshold that moves with ozone) would otherwise draw a band that
 * contradicts the number printed next to it.
 */
export function viableBand(elevations: number[], thresholdElevation: number): ViableBand | null {
  const hoursPerSample = DAY_CURVE_STEP_MINUTES / 60;
  let first = -1;
  let last = -1;
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] >= thresholdElevation) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return null;
  return { startHours: first * hoursPerSample, endHours: last * hoursPerSample };
}
