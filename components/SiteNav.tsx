"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cityPagePath, indexPath } from "@/lib/city-client-links";

// A few high-demand cities surfaced directly in the mobile drawer as a
// shortcut; the full list lives in the footer and the city index.
const DRAWER_CITIES = ["madrid", "londres", "nueva-york", "paris"] as const;

const drawerLinkClass =
  "flex min-h-[44px] items-center text-body text-text-secondary hover:text-text-primary transition-colors";
const inlineLinkClass =
  "text-caption font-medium text-text-secondary hover:text-text-primary transition-colors";

/**
 * Secondary site navigation for the pages outside the bottom tab bar
 * (Partners, city index). Responsive: inline text links on wide desktop, a
 * single menu button opening a drawer below `lg` — the mobile/tablet header is
 * already tight, so text links there would crowd the logo. Deterministic on
 * the server (no mounted gate): the button and the desktop links are in the
 * initial HTML; only the drawer is client-toggled.
 */
export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations();
  const tCities = useTranslations("cities");
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Standard modal-drawer behaviour while open: lock body scroll, move focus
  // into the panel, close on Escape, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return;
    // The hamburger is a stable node, but capture it so the cleanup restores
    // focus to the element that was current when the drawer opened.
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  // Learn/Guide is a primary bottom tab now, so it's not repeated here.
  const secondary = [
    { href: "/connect", label: t("nav.connect") },
    { href: "/partners", label: t("footer.partners") },
  ];

  return (
    <>
      {/* Desktop (lg+): inline links next to the action icons. Gated at lg, not
          md, so a signed-in tablet header keeps room for the logo. */}
      <nav aria-label={t("nav.menu")} className="hidden lg:flex items-center gap-5 mr-1">
        {secondary.map((l) => (
          <Link key={l.href} href={l.href} className={inlineLinkClass}>
            {l.label}
          </Link>
        ))}
        <Link href={indexPath(locale)} className={inlineLinkClass}>
          {t("nav.cities")}
        </Link>
      </nav>

      {/* Mobile/tablet: one menu button. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.menu")}
        aria-expanded={open}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-glass hover:text-text-primary transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="absolute right-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col overflow-y-auto border-l border-border-default bg-surface px-5 py-5 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-caption font-semibold uppercase tracking-[0.14em] text-text-faint">
                {t("nav.menu")}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("nav.close")}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-glass hover:text-text-primary transition-colors"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {secondary.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={drawerLinkClass}>
                {l.label}
              </Link>
            ))}

            <p className="mt-4 text-caption font-semibold uppercase tracking-[0.14em] text-text-faint">
              {t("footer.citiesHeading")}
            </p>
            <ul className="mt-1">
              {DRAWER_CITIES.map((base) => {
                const href = cityPagePath(base, locale);
                if (!href) return null;
                return (
                  <li key={base}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-center text-body text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {tCities.has(base) ? tCities(base) : base}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href={indexPath(locale)}
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-body font-medium text-accent hover:underline"
            >
              {t("footer.allCities")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
