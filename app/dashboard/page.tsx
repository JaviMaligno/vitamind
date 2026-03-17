"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import DayRecommendation from "@/components/dashboard/DayRecommendation";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import CitySearch from "@/components/CitySearch";
import Link from "next/link";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const app = useApp();

  const { records, loading, getToday, toggleOverride, requestBackfill } = useHistory(
    app.lat, app.lon, app.cityId, app.skinType, app.areaFraction, app.age,
  );
  const forecast = useForecast(app.lat, app.lon);

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
        <Link
          href="/profile"
          className="px-3 py-2 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
        >
          {t("editProfile")}
        </Link>
      </div>

      {/* Hero: Today's recommendation */}
      <DayRecommendation
        record={todayRecord}
        cityName={app.cityName}
        cityFlag={app.cityFlag}
        areaFraction={app.areaFraction}
        loading={loading}
      />

      {/* 5-day forecast (expandable) */}
      <ForecastRow
        forecast={forecast}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
      />

      {/* History calendar (replaces WeekTracker + MonthSummary) */}
      <HistoryCalendar
        records={records}
        onToggleOverride={toggleOverride}
        onNavigate={requestBackfill}
      />
    </div>
  );
}
