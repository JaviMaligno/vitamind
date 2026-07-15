"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, X, MapPin } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { haversineKm } from "@/lib/continent";

interface IndexCity {
  name: string;
  href: string;
  flag: string;
  lat: number;
  lon: number;
}

type GeoState = "idle" | "loading" | "denied" | "unavailable";

/**
 * Sticky search + region filter + "near me" for the city index. The index page
 * is a SERVER component (SSG) so all 73 city links ship in the static HTML for
 * SEO — this island never re-renders that list. It filters the server-rendered
 * DOM (each <li> has data-city + data-continent, in a [data-band-section]) for
 * search + region, and for "near me" it hides the band list and renders its own
 * distance-sorted top-8 from the `cities` prop. All those nodes are static HTML
 * (server components don't hydrate), so toggling them is safe.
 */
export default function CityIndexSearch({
  regions,
  cities,
}: {
  regions: string[];
  cities: IndexCity[];
}) {
  const t = useTranslations("cityPage");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [empty, setEmpty] = useState(false);
  const [nearby, setNearby] = useState<(IndexCity & { km: number })[] | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const rootRef = useRef<HTMLDivElement>(null);

  const regionLabel = useCallback(
    (r: string) =>
      r === "all"
        ? t("regionAll")
        : t(`region${r.charAt(0).toUpperCase()}${r.slice(1)}` as "regionEurope"),
    [t],
  );

  const bandSections = useCallback(
    () => rootRef.current?.ownerDocument.querySelectorAll<HTMLElement>("[data-band-section]") ?? [],
    [],
  );

  const applyFilter = useCallback((rawQuery: string, activeRegion: string) => {
    const term = rawQuery.trim().toLowerCase();
    let anyVisible = false;
    bandSections().forEach((section) => {
      let sectionHas = false;
      section.querySelectorAll<HTMLElement>("[data-city]").forEach((li) => {
        const matchQuery = !term || (li.dataset.city ?? "").includes(term);
        const matchRegion = activeRegion === "all" || li.dataset.continent === activeRegion;
        const match = matchQuery && matchRegion;
        li.hidden = !match;
        if (match) sectionHas = true;
      });
      section.hidden = !sectionHas;
      if (sectionHas) anyVisible = true;
    });
    setEmpty(!anyVisible);
  }, [bandSections]);

  const onQuery = useCallback((v: string) => {
    setQuery(v);
    applyFilter(v, region);
  }, [applyFilter, region]);

  const onRegion = useCallback((r: string) => {
    setRegion(r);
    applyFilter(query, r);
  }, [applyFilter, query]);

  const goNearMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("unavailable");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const sorted = cities
          .map((c) => ({ ...c, km: haversineKm(latitude, longitude, c.lat, c.lon) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 8);
        setNearby(sorted);
        setGeo("idle");
        bandSections().forEach((s) => { s.hidden = true; });
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }, [cities, bandSections]);

  const exitNearMe = useCallback(() => {
    setNearby(null);
    setGeo("idle");
    applyFilter(query, region);
  }, [applyFilter, query, region]);

  return (
    <>
      <div ref={rootRef} className="sticky top-2 z-20 mt-6 sm:mt-8 sm:top-4">
        <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-md p-2 shadow-lg space-y-2">
          {!nearby ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder={t("indexSearchPlaceholder")}
                  aria-label={t("indexSearchPlaceholder")}
                  className="min-h-[44px] w-full rounded-xl bg-surface-input pl-10 pr-10 text-body text-text-primary placeholder:text-text-faint outline-none focus-visible:ring-2 focus-visible:ring-sun"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => onQuery("")}
                    aria-label={t("indexClearSearch")}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {/* Near-me + region filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={goNearMe}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-sun/15 px-3 text-caption font-semibold text-sun hover:bg-sun/25 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t("indexNearMe")}
                </button>
                <span className="w-px shrink-0 bg-border-default my-1" aria-hidden />
                {["all", ...regions].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRegion(r)}
                    aria-pressed={region === r}
                    className={`min-h-[36px] shrink-0 rounded-lg px-3 text-caption font-semibold transition-colors ${
                      region === r
                        ? "bg-amber-400/25 text-accent"
                        : "bg-surface-elevated text-text-secondary hover:bg-surface-input"
                    }`}
                  >
                    {regionLabel(r)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1 py-0.5">
              <span className="text-body font-semibold text-text-primary">{t("indexNearYou")}</span>
              <button
                type="button"
                onClick={exitNearMe}
                className="inline-flex min-h-[36px] items-center rounded-lg bg-surface-elevated px-3 text-caption font-semibold text-text-secondary hover:bg-surface-input transition-colors"
              >
                {t("indexShowAll")}
              </button>
            </div>
          )}
        </div>

        {geo === "loading" && <p className="mt-2 text-center text-caption text-text-muted animate-pulse">{t("indexNearMeLocating")}</p>}
        {geo === "denied" && <p className="mt-2 text-center text-caption text-text-muted">{t("indexNearMeDenied")}</p>}
        {geo === "unavailable" && <p className="mt-2 text-center text-caption text-text-muted">{t("indexNearMeUnavailable")}</p>}
        {empty && !nearby && <p className="mt-3 text-center text-body text-text-muted">{t("indexNoResults")}</p>}
      </div>

      {/* Near-me results — distance-sorted top 8, rendered client-side (the SSG
          band list is hidden while this is active). */}
      {nearby && (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((c) => (
            <li key={c.href}>
              <a
                href={c.href}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-glass border border-glass-border backdrop-blur-md px-4 py-3 shadow-lg transition-colors hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-sun"
              >
                <Flag flag={c.flag} className="text-2xl shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold text-text-primary">{c.name}</span>
                  <span className="text-caption text-text-muted">{Math.round(c.km).toLocaleString(locale)} km</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
