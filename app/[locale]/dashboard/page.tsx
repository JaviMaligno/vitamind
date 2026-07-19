"use client";

import { useState, useCallback, useMemo } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import CityPageLink from "@/components/CityPageLink";
import NotificationToggle from "@/components/NotificationToggle";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import { useNowStatus } from "@/hooks/useNowStatus";
import DayHeroBold from "@/components/dashboard/DayHeroBold";
import SunTimesPanel from "@/components/SunTimesPanel";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import ExposureQuickPicker from "@/components/dashboard/ExposureQuickPicker";
import CitySearch from "@/components/CitySearch";
import GpsButton from "@/components/GpsButton";
import PartnerBadge from "@/components/PartnerBadge";
import Card from "@/components/ui/Card";
import Flag from "@/components/ui/Flag";
import PhaseButton from "@/components/PhaseButton";
import GpsErrorHint from "@/components/GpsErrorHint";
import { ArrowRight, MapPin, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Full-row navigation link ("noUvLearnTitle" prompt, "Learn more"): same glass
// surface as Card, accent-coloured chevron, but no underline decoration — a nav
// row, not inline text, so <A> (which is always underlined) doesn't fit here.
const navRowClasses =
  "flex items-center justify-between rounded-2xl bg-glass border border-glass-border backdrop-blur-md px-4 py-3 shadow-lg hover:bg-surface-elevated transition-colors";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tHero = useTranslations("hero");
  const tCity = useTranslations("cityPage");
  const tSun = useTranslations("sunTimes");
  const app = useApp();
  const getCityDisplayName = useCityDisplayName();
  const cityName = getCityDisplayName(app.cityId, app.cityName);
  const hasCity = app.cityId !== "";

  // Daily override for skin exposure (null = use profile default)
  const [areaOverride, setAreaOverride] = useState<number | null>(null);
  const effectiveArea = areaOverride ?? app.areaFraction;
  const handleAreaChange = useCallback((v: number) => setAreaOverride(v), []);
  const handleAreaReset = useCallback(() => setAreaOverride(null), []);

  const { records, loading, getToday, toggleOverride, requestBackfill } = useHistory(
    app.lat, app.lon, app.cityId, app.skinType, effectiveArea, app.age, app.targetIU, app.authUser,
  );
  const forecast = useForecast(app.lat, app.lon);
  const nowStatus = useNowStatus(app.lat, app.lon, app.tz, app.timezone, app.skinType, effectiveArea, app.age, app.targetIU);

  // A few well-known cities to seed the empty state, so a first-time visitor has
  // a one-tap way in instead of a bare search box on a big empty card.
  const popularCities = useMemo(() => {
    const ids = ["builtin:madrid", "builtin:londres", "builtin:nueva-york", "builtin:paris", "builtin:tokio", "builtin:sidney"];
    return ids
      .map((id) => app.allCities.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [app.allCities]);

  const cityRecords = useMemo(
    () => records.filter((r) => r.cityId === app.cityId),
    [records, app.cityId],
  );
  const todayRecord = getToday();

  // Hydration guard: hasCity (localStorage) and several child components
  // (DayRecommendation, HistoryCalendar) derive text from `new Date()`, both
  // of which can differ between server and first client render → React #418.
  // Render a stable, data-free placeholder until mounted, then swap to the
  // real content. All hooks above still run unconditionally every render;
  // only the returned JSX branches on `mounted`.
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 space-y-6">
        <div className="min-h-[540px]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <CitySearch
            onSelect={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
          />
        </div>
        {hasCity && <GpsButton />}
        {hasCity && (
          <Link
            href="/profile"
            aria-label={t("editProfile")}
            title={t("editProfile")}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-glass border border-glass-border px-3 text-text-muted text-caption hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
          >
            <UserRound className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{t("editProfile")}</span>
          </Link>
        )}
      </div>

      {hasCity && (
        <div className="px-1 -mt-2 text-caption">
          <CityPageLink cityId={app.cityId} lat={app.lat} lon={app.lon} />
        </div>
      )}

      {!hasCity && (
        <Card variant="glass" className="text-center space-y-5">
          <div className="space-y-2">
            <h2 className="font-display text-title text-text-primary">{tHero("whereAreYou")}</h2>
            <p className="text-caption text-text-faint">{tHero("searchHint")}</p>
          </div>
          {/* Primary action right where the prompt asks: use my location. */}
          <div className="flex flex-col items-center gap-2">
            <PhaseButton onClick={app.gps.enableGps} disabled={app.gps.loading}>
              <MapPin className="h-4 w-4" aria-hidden />
              {app.gps.loading ? tHero("locating") : tHero("useMyLocation")}
            </PhaseButton>
            {app.gps.error && (
              <GpsErrorHint
                error={tHero(app.gps.error)}
                hint={
                  app.gps.error === "gpsDenied" ? tHero("gpsDeniedHint")
                  : (app.gps.error === "gpsTimeout" || app.gps.error === "gpsUnavailable") ? tHero("gpsEnableHint")
                  : undefined
                }
                onDismiss={app.gps.clearError}
              />
            )}
          </div>
          {popularCities.length > 0 && (
            <div className="space-y-2">
              <p className="text-caption uppercase tracking-wider text-text-muted">{t("popularCities")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {popularCities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => app.selectCity(c)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-elevated px-4 text-body font-medium text-text-secondary hover:bg-surface-input hover:text-text-primary transition-colors"
                  >
                    <Flag flag={c.flag} className="text-lg" />
                    {getCityDisplayName(c.id, c.name)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {hasCity && <>
      {/* Hero: today's live status as a bold poster (phase gradient + earthrise +
          scrim, giant status headline), matching the bold city page. */}
      <DayHeroBold
        nowStatus={nowStatus}
        cityName={cityName}
        cityFlag={app.cityFlag}
        targetIU={app.targetIU}
        loading={loading}
        lat={app.lat}
        lon={app.lon}
      />

      {/* Today's sun times: sunrise/sunset/golden hour/day length at a glance. */}
      <SunTimesPanel
        lat={app.lat}
        lon={app.lon}
        tz={app.tz}
        timezone={app.timezone}
        title={tSun("heading")}
      />

      {/* Exposure + notify: balanced 2-col below the hero. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="glass">
          <ExposureQuickPicker
            value={effectiveArea}
            onChange={handleAreaChange}
            isOverride={areaOverride !== null}
            onReset={handleAreaReset}
          />
        </Card>

        {/* Retention hook: a daily push for this city, only on days it's possible. */}
        <Card variant="glass" className="flex flex-col justify-center gap-3">
          <p className="text-body text-text-secondary">{tCity("notifyLead", { city: cityName })}</p>
          <div>
            <NotificationToggle
              lat={app.lat}
              lon={app.lon}
              tz={app.tz}
              timezone={app.timezone}
              skinType={app.skinType}
              areaFraction={app.areaFraction}
              cityName={cityName}
              labelOff={tCity("notifyOff")}
              labelOn={tCity("notifyOn")}
              prominent
            />
          </div>
        </Card>
      </div>

      {/* 5-day forecast (expandable) */}
      <ForecastRow
        forecast={forecast}
        skinType={app.skinType}
        areaFraction={effectiveArea}
        age={app.age}
        targetIU={app.targetIU}
      />

      {!loading && todayRecord && !todayRecord.sufficient && (
        <div className="space-y-2">
          <Link href="/learn#supplement" className={navRowClasses}>
            <div>
              <p className="text-caption font-medium text-text-secondary">{t("noUvLearnTitle")}</p>
              <p className="text-caption text-text-faint mt-0.5">{t("noUvLearnHint")}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-sun-strong" aria-hidden />
          </Link>
          <PartnerBadge />
        </div>
      )}

      {/* History calendar (replaces WeekTracker + MonthSummary) */}
      <HistoryCalendar
        records={cityRecords}
        onToggleOverride={toggleOverride}
        onNavigate={requestBackfill}
      />
      </>}
    </div>
  );
}
