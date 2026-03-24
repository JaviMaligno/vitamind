"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import { useNowStatus } from "@/hooks/useNowStatus";
import DayRecommendation from "@/components/dashboard/DayRecommendation";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import CitySearch from "@/components/CitySearch";
import GpsButton from "@/components/GpsButton";
import Link from "next/link";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const app = useApp();
  const getCityDisplayName = useCityDisplayName();
  const cityName = getCityDisplayName(app.cityId, app.cityName);

  const { records, loading, getToday, toggleOverride, requestBackfill } = useHistory(
    app.lat, app.lon, app.cityId, app.skinType, app.areaFraction, app.age, app.targetIU, app.authUser,
  );
  const forecast = useForecast(app.lat, app.lon);
  const nowStatus = useNowStatus(app.lat, app.lon, app.tz, app.skinType, app.areaFraction, app.age, app.targetIU);

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
        cityFlag={app.cityFlag}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        targetIU={app.targetIU}
        loading={loading}
      />

      {/* 5-day forecast (expandable) */}
      <ForecastRow
        forecast={forecast}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        targetIU={app.targetIU}
      />

      {!loading && todayRecord && !todayRecord.sufficient && (
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
      )}

      {/* History calendar (replaces WeekTracker + MonthSummary) */}
      <HistoryCalendar
        records={records}
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
