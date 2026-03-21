"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import WorldMap from "@/components/WorldMap";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import DailyCurve from "@/components/DailyCurve";
import VitDEstimate from "@/components/VitDEstimate";
import type { City, SolarPoint, WeatherData } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

type Tab = "curve" | "map" | "heatmap";

interface Props {
  lat: number;
  lon: number;
  doy: number;
  tz: number;
  threshold: number;
  cityName: string;
  cityFlag: string;
  dateLabel: string;
  curve: SolarPoint[];
  weather: WeatherData | null;
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  targetIU: number;
  onSelectCity: (c: City) => void;
  onSelectFromHeatmap: (lat: number, doy: number) => void;
  onThresholdChange: (v: number) => void;
  favorites: string[];
  allCities: City[];
  scrubMode: boolean;
  onScrubModeToggle: () => void;
}

export default function VisualizationZone({
  lat,
  lon,
  doy,
  threshold,
  cityName,
  cityFlag,
  dateLabel,
  curve,
  weather,
  skinType,
  areaFraction,
  age,
  targetIU,
  onSelectCity,
  onSelectFromHeatmap,
  onThresholdChange,
  favorites,
  allCities,
  scrubMode,
  onScrubModeToggle,
}: Props) {
  const [tab, setTab] = useState<Tab>("curve");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const tTabs = useTranslations("tabs");
  const tViz = useTranslations("viz");

  const TABS: { key: Tab; label: string }[] = [
    { key: "curve", label: tTabs("dailyCurve") },
    { key: "map", label: tTabs("worldMap") },
    { key: "heatmap", label: tTabs("heatmap") },
  ];

  return (
    <section className="mx-auto max-w-[960px] px-4 py-2">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-t-lg text-xs font-medium transition-colors cursor-pointer border-b-2 ${
              tab === key
                ? "bg-surface-elevated text-amber-400 border-amber-400 font-semibold"
                : "bg-transparent text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Visualization content */}
      <div className="rounded-xl border border-border-default bg-surface-card p-3">
        {tab === "curve" && (
          <>
            <div className="text-[10px] text-text-muted mb-1 pl-2">
              <strong className="text-text-secondary">{tViz("dailyCurveTitle")}</strong> ·{" "}
              {cityFlag} {cityName} · {dateLabel}
              {weather && (
                <span className="ml-2 text-text-faint">
                  · {tViz("withWeatherData")}
                </span>
              )}
            </div>
            <DailyCurve
              curve={curve}
              threshold={threshold}
              onThresholdChange={onThresholdChange}
              hoverTime={hoverTime}
              onHover={setHoverTime}
              weather={weather}
            />
          </>
        )}

        {tab === "map" && (
          <>
            <div className="flex justify-end mb-1 pr-2">
              <button
                onClick={onScrubModeToggle}
                className={`px-3 py-1 rounded-md text-[9px] cursor-pointer ${
                  scrubMode
                    ? "bg-amber-400/15 text-amber-400 font-semibold"
                    : "bg-surface-elevated text-text-muted"
                }`}
              >
                {scrubMode ? tViz("explore") : tViz("move")}
              </button>
            </div>
            <WorldMap
              lat={lat}
              lon={lon}
              doy={doy}
              onSelect={onSelectCity}
              favorites={favorites}
              allCities={allCities}
              scrubMode={scrubMode}
            />
          </>
        )}

        {tab === "heatmap" && (
          <>
            <div className="text-[10px] text-text-muted mb-1 pl-2">
              <strong className="text-text-secondary">{tViz("heatmapTitle")}</strong> ·{" "}
              {tViz("heatmapDesc")} ·{" "}
              <em>{tViz("heatmapHint")}</em>
            </div>
            <GlobalHeatmap
              selectedLat={lat}
              selectedDoy={doy}
              onSelect={onSelectFromHeatmap}
            />
          </>
        )}
      </div>

      {/* VitD Estimate — always visible below */}
      <div className="mt-3">
        <VitDEstimate
          weather={weather}
          curve={curve}
          skinType={skinType}
          areaFraction={areaFraction}
          age={age}
          targetIU={targetIU}
        />
      </div>
    </section>
  );
}
