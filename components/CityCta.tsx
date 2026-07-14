"use client";
import { Link } from "@/i18n/navigation";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * Primary CTA that adapts to the live solar phase: a CLEAN solid fill per phase
 * (--cta-{phase}) instead of a fixed orange — the previous gradient+scrim read
 * muddy/mustard, and the night gradient camouflaged against the navy page. Each
 * token is a saturated colour validated ≥4.5:1 with white that stands out
 * against that phase's page tint (night uses a bright violet).
 *
 * Client island so the city page stays server-rendered.
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
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 text-heading font-bold text-white shadow-lg transition-[filter] hover:brightness-110 min-h-[56px] sm:w-auto sm:min-w-[420px]"
      style={{ background: PHASE_STYLE[phase].cta }}
      suppressHydrationWarning
    >
      {label}
    </Link>
  );
}
