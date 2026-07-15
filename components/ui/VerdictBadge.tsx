type Tone = "possible" | "winter";

/** Pieza focal de la city page: el veredicto sí/no + meses, en color semántico. */
export default function VerdictBadge({
  tone,
  children,
}: { tone: Tone; children: React.ReactNode }) {
  const skin =
    tone === "possible"
      ? "bg-possible-surface text-possible border-possible-border"
      : "bg-surface-elevated text-winter border-border-subtle";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-title font-bold ${skin}`}>
      {children}
    </span>
  );
}
