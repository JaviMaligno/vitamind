"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppProvider";
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
import Link from "next/link";
import { getDemoScenario, getDemoForecast } from "@/lib/demo";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const app = useApp();
  const getCityDisplayName = useCityDisplayName();

  // Demo mode: ?demo=<scenarioId> overrides nowStatus, forecast, city display.
  // Scenario IDs are defined in lib/demo.ts. This branch is for promotional
  // screenshots only and is not merged into master.
  const searchParams = useSearchParams();
  const demoId = searchParams.get("demo");
  const demo = getDemoScenario(demoId);
  const demoForecast = useMemo(() => getDemoForecast(demoId), [demoId]);

  const cityName = demo ? demo.cityName : getCityDisplayName(app.cityId, app.cityName);
  const cityFlag = demo ? demo.cityFlag : app.cityFlag;

  // Daily override for skin exposure (null = use profile default)
  const [areaOverride, setAreaOverride] = useState<number | null>(null);
  const effectiveArea = areaOverride ?? app.areaFraction;
  const handleAreaChange = useCallback((v: number) => setAreaOverride(v), []);
  const handleAreaReset = useCallback(() => setAreaOverride(null), []);

  const { records, loading, getToday, toggleOverride, requestBackfill } = useHistory(
    app.lat, app.lon, app.cityId, app.skinType, effectiveArea, app.age, app.targetIU, app.authUser,
  );
  const realForecast = useForecast(app.lat, app.lon);
  const realNowStatus = useNowStatus(app.lat, app.lon, app.tz, app.timezone, app.skinType, effectiveArea, app.age, app.targetIU);
  const nowStatus = demo ? demo.nowStatus : realNowStatus;
  const forecast = demo ? demoForecast : realForecast;
  const dashboardLoading = demo ? false : loading;

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
        <Link
          href="/profile"
          className="px-3 py-2 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
        >
          {t("editProfile")}
        </Link>
      </div>

      {/* Hero: Today's recommendation */}
      <DayRecommendation
        nowStatus={nowStatus}
        cityName={cityName}
        cityFlag={cityFlag}
        skinType={app.skinType}
        areaFraction={effectiveArea}
        age={app.age}
        targetIU={app.targetIU}
        loading={dashboardLoading}
      />

      {/* Quick exposure picker */}
      <ExposureQuickPicker
        value={effectiveArea}
        onChange={handleAreaChange}
        isOverride={areaOverride !== null}
        onReset={handleAreaReset}
      />

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
          <Link
            href="/learn#supplement"
            className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3 hover:bg-surface-elevated transition-colors"
          >
            <div>
              <p className="text-[12px] font-medium text-text-secondary">{t("noUvLearnTitle")}</p>
              <p className="text-[10px] text-text-faint mt-0.5">{t("noUvLearnHint")}</p>
            </div>
            <span className="text-text-faint text-[11px]">→</span>
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

      {/* Learn more — always visible */}
      <Link
        href="/learn"
        className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3 hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-[12px] font-medium text-text-secondary">{tc("learnMore")}</span>
        </div>
        <span className="text-text-faint text-[11px]">→</span>
      </Link>
    </div>
  );
}
