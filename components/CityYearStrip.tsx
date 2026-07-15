/**
 * Static SVG strip of a city's year: one column per day, colored by the hours of
 * viable vitamin-D sun that day. Server-rendered (no "use client") so the markup
 * ships in the static HTML. Color ramp matches GlobalHeatmap.
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
  const width = 365;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
      >
        {hoursByDay.map((hrs, i) => {
          const t = Math.min(hrs / 10, 1);
          const fill = `hsl(${45 - t * 25}, ${80 + t * 20}%, ${15 + t * 50}%)`;
          return <rect key={i} x={i} y={0} width={1} height={height} fill={fill} />;
        })}
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
          <span style={{ flex: 1, height: 8, borderRadius: 99,
            background: "linear-gradient(90deg, hsl(45,80%,15%), hsl(20,100%,65%))" }} />
          <span style={{ fontSize: 12 }} className="text-on-window-faint">{legend.high}</span>
        </div>
      )}
      <figcaption className="text-on-window-faint" style={{ fontSize: 12, marginTop: 4 }}>{caption}</figcaption>
    </figure>
  );
}
