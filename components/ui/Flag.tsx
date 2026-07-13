import { flagCode } from "@/lib/flag";

/**
 * Real SVG flag rendered from a flag emoji, via flag-icons. Falls back to the
 * original glyph when the emoji isn't a country flag (e.g. the GPS pin 📍) so
 * callers can pass whatever is in the data. Server-safe (no client hooks).
 *
 * Size follows the inherited font-size (the .fi box is 1em tall, 1.33em wide),
 * so size it with a text utility in `className` (e.g. "text-2xl").
 */
export default function Flag({
  flag,
  className = "",
  label,
}: {
  flag: string | null | undefined;
  className?: string;
  label?: string;
}) {
  const code = flagCode(flag);
  if (!code) {
    return flag ? <span className={className} aria-hidden="true">{flag}</span> : null;
  }
  return (
    <span
      className={`fi fi-${code} rounded-[3px] ring-1 ring-black/10 ${className}`}
      style={{ verticalAlign: "-0.15em" }}
      role="img"
      aria-label={label}
    />
  );
}
