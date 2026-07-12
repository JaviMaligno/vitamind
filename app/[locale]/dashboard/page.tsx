"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import CityPageLink from "@/components/CityPageLink";
import NotificationToggle from "@/components/NotificationToggle";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import { useNowStatus } from "@/hooks/useNowStatus";
import DayRecommendation from "@/components/dashboard/DayRecommendation";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import ExposureQuickPicker from "@/components/dashboard/ExposureQuickPicker";
import CitySearch from "@/components/CitySearch";
import GpsButton from "@/components/GpsButton";
import PartnerBadge from "@/components/PartnerBadge";
import CityHero from "@/components/CityHero";
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

  return (
    <div className="mx-auto max-w-[960px] px-3 space-y-4">
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
      {/* Hero: Today's recommendation — same phase-gradient + earthrise + glass-card
          pattern as the city page, so My Day matches it. */}
      <CityHero lat={app.lat} lon={app.lon}>
        <DayRecommendation
          nowStatus={nowStatus}
          cityName={cityName}
          cityFlag={app.cityFlag}
          targetIU={app.targetIU}
          loading={loading}
        />
      </CityHero>

      {/* Quick exposure picker */}
      <Card variant="glass">
        <ExposureQuickPicker
          value={effectiveArea}
          onChange={handleAreaChange}
          isOverride={areaOverride !== null}
          onReset={handleAreaReset}
        />
      </Card>

      {/* Retention hook: a daily push for this city, only on days it's possible.
          Moved below the exposure picker so it no longer competes with the hero. */}
      <div className="flex flex-wrap items-center gap-3 px-1">
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
        <span className="text-caption text-text-muted">{tCity("notifyLead", { city: cityName })}</span>
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
