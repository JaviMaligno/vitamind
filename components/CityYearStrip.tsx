/**
 * Static SVG strip of a city's year: one column per day, colored by the hours of
 * viable vitamin-D sun that day. Server-rendered (no "use client") so the markup
 * ships in the static HTML. Color ramp matches GlobalHeatmap.
 */
export default function CityYearStrip({
  hoursByDay,
  monthLabels,
  caption,
}: {
  hoursByDay: number[];
  monthLabels: string[];
  caption: string;
}) {
  const width = 365;
  const height = 48;

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
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${monthLabels.length}, 1fr)`,
          fontSize: 10,
          opacity: 0.7,
          marginTop: 4,
        }}
      >
        {monthLabels.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <figcaption style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{caption}</figcaption>
    </figure>
  );
}
