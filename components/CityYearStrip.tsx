import { HEAT_LEGEND_GRADIENT, yearStripColumns, yearStripViewBox } from "@/lib/year-strip";

/**
 * Static SVG strip of a city's year: one column per day, colored by the hours of
 * viable vitamin-D sun that day. Server-rendered (no "use client") so the markup
 * ships in the static HTML.
 *
 * The ramp and the column geometry live in `lib/year-strip.ts`, shared with
 * GlobalHeatmap and with the MCP App widget so all three draw the same picture.
 * That module is pure and DOM-free, so importing it keeps this a Server Component.
 */
export default function CityYearStrip({
  hoursByDay,
  monthLabels,
  caption,
  legend,
  height = 48,
}: {
  hoursByDay: number[];
  monthLabels: string[];
  caption: string;
  legend?: { low: string; high: string };
  /** SVG height in px — same data/ramp, just a taller strip for a bigger treatment. */
  height?: number;
}) {
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={yearStripViewBox(hoursByDay.length, height)}
        width="100%"
        height={height}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
      >
        {yearStripColumns(hoursByDay).map((col) => (
          <rect key={col.x} x={col.x} y={0} width={col.width} height={height} fill={col.fill} />
        ))}
      </svg>
      <div
        className="text-on-window-faint"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${monthLabels.length}, 1fr)`,
          fontSize: 12,
          marginTop: 4,
        }}
      >
        {monthLabels.map((m, i) => (
          <span key={`${m}-${i}`}>{m}</span>
        ))}
      </div>
      {legend && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12 }} className="text-on-window-faint">{legend.low}</span>
          <span style={{ flex: 1, height: 8, borderRadius: 99, background: HEAT_LEGEND_GRADIENT }} />
          <span style={{ fontSize: 12 }} className="text-on-window-faint">{legend.high}</span>
        </div>
      )}
      <figcaption className="text-on-window-faint" style={{ fontSize: 12, marginTop: 4 }}>{caption}</figcaption>
    </figure>
  );
}
