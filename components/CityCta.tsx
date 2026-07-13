"use client";
import { Link } from "@/i18n/navigation";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * Primary CTA that adapts to the live solar phase instead of a fixed colour: its
 * fill is the phase's vibrant gradient (the same one the hero uses), so it echoes
 * the sky of the moment and stands out against the soft phase tint of the page —
 * a fixed warm orange washed out on the warm phases (dawn/dusk).
 *
 * Client island so the city page stays server-rendered. A dark scrim over the
 * gradient guarantees white-text contrast across every phase (some gradients
 * have light zones); it lightens on hover for feedback.
 */
export default function CityCta({
  lat,
  lon,
  href,
  label,
}: {
  lat: number;
  lon: number;
  href: string;
  label: string;
}) {
  const phase = useSolarPhase(lat, lon) ?? "day";
  return (
    <Link
      href={href}
      className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 text-heading font-bold text-white shadow-lg min-h-[56px] sm:w-auto sm:min-w-[420px] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]"
    >
      <span className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" aria-hidden />
      <span className="relative">{label}</span>
    </Link>
  );
}
