"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { activePartner, getPartnerUrl } from "@/lib/partners";

/**
 * Shows a partner badge/link when a partner is configured,
 * otherwise renders nothing. Drop this into any supplement
 * recommendation area for automatic partner integration.
 */
export default function PartnerBadge({ className = "" }: { className?: string }) {
  const locale = useLocale();

  if (!activePartner) return null;

  const tagline = activePartner.tagline[locale] ?? activePartner.tagline.en ?? "";
  const url = getPartnerUrl(activePartner);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400/80 hover:bg-amber-500/10 transition-colors ${className}`}
    >
      <span className="font-semibold">{activePartner.name}</span>
      <span className="text-text-faint">·</span>
      <span>{tagline}</span>
      <span className="ml-0.5">↗</span>
    </a>
  );
}
