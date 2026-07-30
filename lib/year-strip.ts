/**
 * The year-strip heat ramp and column geometry — the one place that decides how
 * "hours of viable vitamin-D sun" become a colour.
 *
 * Three consumers draw the same picture from this module and must agree
 * pixel-for-pixel:
 *   - `components/CityYearStrip.tsx` (server-rendered SVG on the city pages),
 *   - `components/GlobalHeatmap.tsx` (canvas),
 *   - `widgets/year-strip/*` (the MCP App widget bundled into an iframe).
 *
 * Deliberately dependency-free and DOM-free: the widget bundle imports it
 * directly, so anything pulled in here would be shipped to the iframe too.
 *
 * The ramp is calibrated for a DARK plate: `HEAT_LOW` (0 h) is nearly black.
 * Whoever draws it owns the dark background behind it — see the widget's fixed
 * navy plate. It is not decoration, it is the bottom of the scale.
 */

/** Hours of viable sun that saturate the ramp (t = 1). */
export const HEAT_MAX_HOURS = 10;

/** Hours → [0, 1], clamped at both ends. */
export function heatT(hours: number, maxHours: number = HEAT_MAX_HOURS): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(hours / maxHours, 1);
}

/**
 * The heat ramp, as a CSS colour.
 *
 * The string format is load-bearing: this exact spacing is what the city pages
 * already ship inside static HTML for 438 routes. Changing `, ` to `,` here
 * would rewrite that markup with no visual difference and no test to catch it,
 * so the format stays. Same order of operations too — reassociating the
 * arithmetic would introduce float drift in the emitted digits.
 */
export function heatColor(hours: number, maxHours: number = HEAT_MAX_HOURS): string {
  const t = heatT(hours, maxHours);
  return `hsl(${45 - t * 25}, ${80 + t * 20}%, ${15 + t * 50}%)`;
}

/** The 0 h end of the ramp — nearly black, intended to sit on a dark plate. */
export const HEAT_LOW = "hsl(45, 80%, 15%)";
/** The saturated end of the ramp (>= HEAT_MAX_HOURS). */
export const HEAT_HIGH = "hsl(20, 100%, 65%)";
/** Legend swatch spanning the ramp. Compact form — it is a CSS value, not markup. */
export const HEAT_LEGEND_GRADIENT =
  "linear-gradient(90deg, hsl(45,80%,15%), hsl(20,100%,65%))";

export interface YearStripColumn {
  /** X position in viewBox units — one unit per day, so this is the day index. */
  x: number;
  width: number;
  fill: string;
}

/** One unit-wide column per day, in order. */
export function yearStripColumns(
  hoursByDay: number[],
  maxHours: number = HEAT_MAX_HOURS,
): YearStripColumn[] {
  return hoursByDay.map((hrs, i) => ({ x: i, width: 1, fill: heatColor(hrs, maxHours) }));
}

/**
 * The strip's viewBox. Width is the day count, NOT a hardcoded 365: with
 * `preserveAspectRatio="none"` a mismatched array used to draw off-canvas
 * silently, which is exactly the failure mode a remote MCP client could feed us.
 */
export function yearStripViewBox(dayCount: number, height: number): string {
  return `0 0 ${dayCount} ${height}`;
}
