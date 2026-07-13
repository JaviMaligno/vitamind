"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import CityPageLink from "@/components/CityPageLink";
import NotificationToggle from "@/components/NotificationToggle";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import { useNowStatus } from "@/hooks/useNowStatus";
import DayHeroBold from "@/components/dashboard/DayHeroBold";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import ExposureQuickPicker from "@/components/dashboard/ExposureQuickPicker";
import CitySearch from "@/components/CitySearch";
import GpsButton from "@/components/GpsButton";
import PartnerBadge from "@/components/PartnerBadge";
import Card from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

// Full-row navigation link ("noUvLearnTitle" prompt, "Learn more"): same glass
// surface as Card, accent-coloured chevron, but no underline decoration — a nav
// row, not inline text, so <A> (which is always underlined) doesn't fit here.
const navRowClasses =
  "flex items-center justify-between rounded-2xl bg-glass border border-glass-border backdrop-blur-md px-4 py-3 shadow-lg hover:bg-surface-elevated transition-colors";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tHero = useTranslations("hero");
  const tCity = useTranslations("cityPage");
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        <div className="flex-1">
          <CitySearch
            onSelect={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
          />
        </div>
        <GpsButton />
        {hasCity && (
          <Link
            href="/profile"
            className="px-3 py-2 rounded-lg bg-glass border border-glass-border text-text-muted text-caption hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
          >
            {t("editProfile")}
          </Link>
        )}
      </div>

      {hasCity && (
        <div className="px-1 -mt-2 text-caption">
          <CityPageLink cityId={app.cityId} lat={app.lat} lon={app.lon} />
        </div>
      )}

      {!hasCity && (
        <Card variant="glass" className="text-center space-y-2">
          <h2 className="font-display text-title text-text-primary">{tHero("whereAreYou")}</h2>
          <p className="text-caption text-text-faint">{tHero("searchHint")}</p>
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
            <span className="text-sun-strong text-caption">→</span>
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

      {/* Learn more — always visible */}
      <Link href="/learn" className={navRowClasses}>
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-caption font-medium text-text-secondary">{tc("learnMore")}</span>
        </div>
        <span className="text-sun-strong text-caption">→</span>
      </Link>
    </div>
  );
}
