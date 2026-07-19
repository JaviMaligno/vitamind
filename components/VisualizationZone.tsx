"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { LineChart, Globe, Grid3x3 } from "lucide-react";
import { useTranslations } from "next-intl";
import WorldMap from "@/components/WorldMap";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import DailyCurve from "@/components/DailyCurve";
import PhaseWindow from "@/components/PhaseWindow";
import VitDEstimate from "@/components/VitDEstimate";
import Flag from "@/components/ui/Flag";
import { synthesisThresholdElevation } from "@/lib/uv-model";
import type { City, SolarPoint, WeatherData } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

type Tab = "curve" | "map" | "heatmap";

interface Props {
  lat: number;
  lon: number;
  doy: number;
  tz: number;
  timezone?: string;
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
  const tCfg = useTranslations("config");

  const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: "curve", label: tTabs("dailyCurve"), Icon: LineChart },
    { key: "map", label: tTabs("worldMap"), Icon: Globe },
    { key: "heatmap", label: tTabs("heatmap"), Icon: Grid3x3 },
  ];

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-2">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-lg text-body font-medium transition-colors cursor-pointer border-b-2 ${
              tab === key
                ? "bg-surface-elevated text-accent border-amber-400 font-semibold"
                : "bg-transparent text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Visualization content — a dark "window to the sky" TINTED by the live
          solar phase (PhaseWindow), so the frame matches the moment of day
          instead of always reading as night. The charts stay on dark fills —
          the heat palette needs the contrast. */}
      <PhaseWindow lat={lat} lon={lon} className="p-4" testId="viz-window">
        {tab === "curve" && (
          <>
            <div className="text-caption text-on-window-faint mb-2 pl-2">
              <strong className="text-on-window">{tViz("dailyCurveTitle")}</strong> ·{" "}
              <Flag flag={cityFlag} className="text-caption" /> {cityName} · {dateLabel}
              {weather && (
                <span className="ml-2 text-on-window-faint">
                  · {tViz("withWeatherData")}
                </span>
              )}
            </div>
            {/* Threshold control — a titled, touch-friendly tray outside the chart
                (replaces the tiny in-chart ▲/▼ widget). */}
            <div className="mb-3 flex flex-wrap items-center gap-3 pl-2">
              <span className="text-caption uppercase tracking-wider text-on-window-faint">{tCfg("threshold")}</span>
              <div className="inline-flex items-center gap-1 rounded-xl bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => onThresholdChange(Math.max(20, threshold - 5))}
                  aria-label="−5°"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-on-window hover:bg-white/10 transition-colors"
                >−</button>
                <span className="min-w-[52px] text-center font-mono text-body font-semibold text-on-window">{threshold}°</span>
                <button
                  type="button"
                  onClick={() => onThresholdChange(Math.min(70, threshold + 5))}
                  aria-label="+5°"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-on-window hover:bg-white/10 transition-colors"
                >+</button>
              </div>
            </div>
            <DailyCurve
              curve={curve}
              threshold={threshold}
              hoverTime={hoverTime}
              onHover={setHoverTime}
              weather={weather}
              // This tab shows one specific place on one specific day, so use the
              // exact per-day synthesis threshold. lat/lon/doy are in scope here;
              // elevation is not plumbed this far, so it defaults to sea level.
              thresholdElevation={synthesisThresholdElevation(lat, lon, doy)}
            />
          </>
        )}

        {tab === "map" && (
          <>
            <div className="flex justify-end mb-2 pr-2">
              <button
                onClick={onScrubModeToggle}
                className={`px-3 py-1.5 rounded-md text-caption cursor-pointer ${
                  scrubMode
                    ? "bg-amber-400/20 text-amber-300 font-semibold"
                    : "bg-white/10 text-on-window-faint hover:bg-white/15"
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
            <div className="text-caption text-on-window-faint mb-2 pl-2">
              <strong className="text-on-window">{tViz("heatmapTitle")}</strong> ·{" "}
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
      </PhaseWindow>

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
