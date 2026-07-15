export { Bell, BellRing, Sun, Moon, SunMedium, MapPin, ChevronRight, Search } from "lucide-react";

/** Glifo solar propio de marca (arco del sol). 24x24, hereda currentColor. */
export function SunArc({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 18 Q12 2 22 18" strokeLinecap="round" />
      <circle cx="12" cy="8" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
