"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cityPagePath, indexPath } from "@/lib/city-client-links";

// Keys of the generated CITY_SLUGS map. Short fixed list: these links render in
// the HTML of every page, so each entry funnels sitewide link equity to one
// city page — search-demand capitals with es/en market coverage only.
const FOOTER_CITIES = [
  "madrid", "barcelona", "londres", "paris", "berlin",
  "roma", "nueva-york", "los-angeles", "ciudad-de-mexico", "buenos-aires",
] as const;

const headingClass =
  "text-caption font-semibold uppercase tracking-[0.14em] text-text-faint";
// min-h-[44px] is the mobile tap-target floor; the height doubles as the
// vertical rhythm of the lists, so the <ul>s carry no gap of their own.
const linkClass =
  "flex min-h-[44px] items-center text-body text-text-muted hover:text-text-secondary transition-colors";

/**
 * Global site footer: persistent nav to the pages outside the bottom tab bar
 * plus sitewide internal links to popular city pages for SEO. Client component
 * but fully server-rendered — it must NOT use a mounted gate or any browser
 * state, or the links vanish from the initial HTML crawlers see. Lives outside
 * SwipeNav so it does not re-animate on tab changes.
 */
export default function SiteFooter() {
  const locale = useLocale();
  const t = useTranslations();
  const tCities = useTranslations("cities");

  const appLinks = [
    { href: "/dashboard", label: t("nav.myDay") },
    { href: "/explore", label: t("nav.explore") },
    { href: "/profile", label: t("nav.profile") },
    { href: "/learn", label: t("footer.learn") },
    { href: "/partners", label: t("footer.partners") },
  ];

  return (
    // A border-top band, not another glass card — same language as the city
    // page's nearby nav, so site chrome never competes with content cards.
    <footer className="mt-12 sm:mt-16 border-t border-border-default">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-10 sm:py-12 md:grid-cols-[1fr_1.8fr_1.4fr] md:gap-8">
        <nav aria-labelledby="footer-app-heading">
          <p id="footer-app-heading" className={headingClass}>
            {t("footer.appHeading")}
          </p>
          <ul className="mt-3">
            {appLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-cities-heading">
          <p id="footer-cities-heading" className={headingClass}>
            {t("footer.citiesHeading")}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-3 md:grid-cols-2">
            {FOOTER_CITIES.map((base) => {
              // cityPagePath returns null for a slug unknown in this locale;
              // skipping the entry beats rendering a broken link.
              const href = cityPagePath(base, locale);
              if (!href) return null;
              return (
                <li key={base}>
                  <Link href={href} className={linkClass}>
                    {tCities.has(base) ? tCities(base) : base}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={indexPath(locale)}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-body font-medium text-accent hover:underline"
          >
            {t("footer.allCities")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>

        <div>
          {/* Mini wordmark: the TopBar's amber gradient (darker in light themes,
              brighter in dark) at reduced scale — brand signature without
              repeating the full-size logo. */}
          <p className="font-display text-[18px] font-extrabold tracking-tight bg-gradient-to-br from-amber-600 to-amber-800 dark:from-amber-400 dark:to-amber-600 bg-clip-text text-transparent">
            {t("app.title")}
          </p>
          <p className="mt-3 text-caption text-text-faint leading-relaxed">
            {t("app.footer")}
          </p>
          <a
            href="https://javieraguilar.ai"
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex min-h-[44px] items-center text-caption text-text-faint underline hover:text-text-secondary transition-colors"
          >
            {t("app.builtBy")}
          </a>
        </div>
      </div>
    </footer>
  );
}
