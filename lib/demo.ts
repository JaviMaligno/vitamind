import type { NowStatus } from "./types";
import type { ForecastDay } from "@/hooks/useForecast";

export type DemoScenarioId =
  | "madrid-optimal"
  | "tokyo-optimal"
  | "miami-optimal"
  | "quito-strong"
  | "nyc-moderate"
  | "london-upcoming"
  | "oslo-winter"
  | "sydney-closed";

export interface DemoScenario {
  id: DemoScenarioId;
  cityName: string;
  cityFlag: string;
  nowStatus: NowStatus;
  forecastSeed: {
    peakUVI: number;
    avgCloud: number;
    windowStart: number;
    windowEnd: number;
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildForecast(seed: DemoScenario["forecastSeed"]): ForecastDay[] {
  const today = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const peakVar = Math.max(0, seed.peakUVI + ((i % 3) - 1) * 0.4);
    const cloudVar = Math.max(0, Math.min(100, seed.avgCloud + ((i % 3) - 1) * 6));
    const noWindow = seed.windowStart < 0;
    return {
      date: dateStr,
      dayName: DAY_NAMES[d.getDay()],
      peakUVI: Math.round(peakVar * 10) / 10,
      avgCloud: Math.round(cloudVar),
      windowStart: noWindow ? -1 : seed.windowStart,
      windowEnd: noWindow ? -1 : seed.windowEnd,
      hours: Array.from({ length: 24 }, (_, h) => {
        let uvIndex = 0;
        if (noWindow) {
          uvIndex = h >= 11 && h <= 13 ? Math.min(2.5, peakVar) : 0;
        } else if (h >= seed.windowStart && h < seed.windowEnd) {
          uvIndex = peakVar;
        } else if (
          (h >= seed.windowStart - 2 && h < seed.windowStart) ||
          (h >= seed.windowEnd && h < seed.windowEnd + 2)
        ) {
          uvIndex = Math.min(3.2, peakVar / 2);
        }
        return {
          time: `${dateStr}T${String(h).padStart(2, "0")}:00`,
          uvIndex: Math.round(uvIndex * 10) / 10,
          cloudCover: Math.round(cloudVar),
        };
      }),
    };
  });
}

const SCENARIOS: Record<DemoScenarioId, Omit<DemoScenario, "id">> = {
  "madrid-optimal": {
    cityName: "Madrid",
    cityFlag: "🇪🇸",
    nowStatus: {
      state: "good_now",
      currentUVI: 7.8,
      effectiveUVI: 7.4,
      intensity: "optimal",
      minutesNeeded: 12,
      window: { start: 11, end: 16 },
      bestHour: 13,
      bestMinutes: 11,
      minutesUntilWindow: null,
      windowClosesIn: 165,
      cloudCover: 12,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 7.4, avgCloud: 14, windowStart: 11, windowEnd: 16 },
  },
  "tokyo-optimal": {
    cityName: "Tokyo",
    cityFlag: "🇯🇵",
    nowStatus: {
      state: "good_now",
      currentUVI: 7.0,
      effectiveUVI: 6.8,
      intensity: "optimal",
      minutesNeeded: 14,
      window: { start: 10, end: 15 },
      bestHour: 12,
      bestMinutes: 13,
      minutesUntilWindow: null,
      windowClosesIn: 140,
      cloudCover: 18,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 6.8, avgCloud: 22, windowStart: 10, windowEnd: 15 },
  },
  "miami-optimal": {
    cityName: "Miami",
    cityFlag: "🇺🇸",
    nowStatus: {
      state: "good_now",
      currentUVI: 9.5,
      effectiveUVI: 9.1,
      intensity: "optimal",
      minutesNeeded: 8,
      window: { start: 10, end: 17 },
      bestHour: 13,
      bestMinutes: 7,
      minutesUntilWindow: null,
      windowClosesIn: 230,
      cloudCover: 10,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 9.1, avgCloud: 12, windowStart: 10, windowEnd: 17 },
  },
  "quito-strong": {
    cityName: "Quito",
    cityFlag: "🇪🇨",
    nowStatus: {
      state: "good_now",
      currentUVI: 11.8,
      effectiveUVI: 11.5,
      intensity: "optimal",
      minutesNeeded: 6,
      window: { start: 9, end: 17 },
      bestHour: 12,
      bestMinutes: 5,
      minutesUntilWindow: null,
      windowClosesIn: 240,
      cloudCover: 8,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 11.5, avgCloud: 9, windowStart: 9, windowEnd: 17 },
  },
  "nyc-moderate": {
    cityName: "New York",
    cityFlag: "🇺🇸",
    nowStatus: {
      state: "good_now",
      currentUVI: 4.5,
      effectiveUVI: 4.3,
      intensity: "moderate",
      minutesNeeded: 22,
      window: { start: 11, end: 15 },
      bestHour: 13,
      bestMinutes: 21,
      minutesUntilWindow: null,
      windowClosesIn: 110,
      cloudCover: 35,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 4.3, avgCloud: 38, windowStart: 11, windowEnd: 15 },
  },
  "london-upcoming": {
    cityName: "London",
    cityFlag: "🇬🇧",
    nowStatus: {
      state: "upcoming",
      currentUVI: 1.8,
      effectiveUVI: 1.6,
      intensity: null,
      minutesNeeded: null,
      window: { start: 12, end: 14 },
      bestHour: 13,
      bestMinutes: 28,
      minutesUntilWindow: 135,
      windowClosesIn: null,
      cloudCover: 45,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 4.0, avgCloud: 50, windowStart: 12, windowEnd: 14 },
  },
  "oslo-winter": {
    cityName: "Oslo",
    cityFlag: "🇳🇴",
    nowStatus: {
      state: "no_synthesis",
      currentUVI: 0.4,
      effectiveUVI: 0.3,
      intensity: null,
      minutesNeeded: null,
      window: null,
      bestHour: null,
      bestMinutes: null,
      minutesUntilWindow: null,
      windowClosesIn: null,
      cloudCover: 70,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 1.2, avgCloud: 72, windowStart: -1, windowEnd: -1 },
  },
  "sydney-closed": {
    cityName: "Sydney",
    cityFlag: "🇦🇺",
    nowStatus: {
      state: "window_closed",
      currentUVI: 1.2,
      effectiveUVI: 1.0,
      intensity: null,
      minutesNeeded: null,
      window: { start: 9, end: 16 },
      bestHour: null,
      bestMinutes: null,
      minutesUntilWindow: null,
      windowClosesIn: null,
      cloudCover: 28,
      cloudDegraded: false,
    },
    forecastSeed: { peakUVI: 6.5, avgCloud: 28, windowStart: 9, windowEnd: 16 },
  },
};

export const DEMO_SCENARIO_IDS = Object.keys(SCENARIOS) as DemoScenarioId[];

export function getDemoScenario(id: string | null): DemoScenario | null {
  if (!id || !(id in SCENARIOS)) return null;
  const base = SCENARIOS[id as DemoScenarioId];
  return { id: id as DemoScenarioId, ...base };
}

export function getDemoForecast(id: string | null): ForecastDay[] | null {
  const s = getDemoScenario(id);
  return s ? buildForecast(s.forecastSeed) : null;
}
