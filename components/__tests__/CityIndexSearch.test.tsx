import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Same mock as CityPageLink.test.tsx: keys and interpolated numbers, not copy.
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      const head = ns ? `${ns}.${key}` : key;
      if (!values) return head;
      const args = Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join("|");
      return `${head}[${args}]`;
    };
    t.has = () => true;
    return t;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import CityIndexSearch from "@/components/CityIndexSearch";
import CityPageLink from "@/components/CityPageLink";
import { BUILTIN_CITIES } from "@/lib/cities";
import { NEARBY_PHRASING_KM, haversineKm } from "@/lib/nearest-city";

const TOLEDO = { lat: 39.8581, lon: -4.0226 };     // Madrid,  68 km
const SALAMANCA = { lat: 40.9701, lon: -5.6635 };  // Madrid, 176 km
const NAPLES = { lat: 40.8518, lon: 14.2681 };     // Rome,   188 km

const indexCities = BUILTIN_CITIES.map((c) => ({
  name: c.name,
  href: `/vitamin-d/${c.id.replace(/^builtin:/, "")}`,
  flag: c.flag ?? "",
  lat: c.lat,
  lon: c.lon,
}));

function atCoords(lat: number, lon: number) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) =>
        ok({ coords: { latitude: lat, longitude: lon } }),
    },
  });
}

function nearMe(lat: number, lon: number) {
  atCoords(lat, lon);
  render(<CityIndexSearch regions={["europe", "americas"]} cities={indexCities} />);
  fireEvent.click(screen.getByRole("button", { name: /indexNearMe$/ }));
}

/** The value the chip interpolated for `km`, from `cityPage.someKey[a=1|km=188]`. */
function kmArg(label: string): string | null {
  const at = label.indexOf("km=");
  if (at === -1) return null;
  const rest = label.slice(at + 3);
  const end = Math.min(...["|", "]"].map((c) => (rest.includes(c) ? rest.indexOf(c) : rest.length)));
  return rest.slice(0, end);
}

beforeEach(() => cleanup());

describe("CityIndexSearch — the word 'near' now means what it means in the chip", () => {
  // D-1(d) / §3: the index used its own private NEAR_THRESHOLD_KM = 500. It now shares
  // NEARBY_PHRASING_KM with lib/nearest-city, which is 100 — one degree of latitude
  // projected onto the ground. That asymmetry is what made the chip a bug.
  it("imports its threshold from the shared module", () => {
    expect(NEARBY_PHRASING_KM).toBe(100);
  });

  it("says how far the nearest is when it is genuinely near", () => {
    nearMe(TOLEDO.lat, TOLEDO.lon);
    expect(screen.getByText(/cityPage\.indexNearestDistance\[km=68\]/)).toBeTruthy();
  });

  // 176 km used to read "the nearest is 176 km away" under the 500 km rule.
  it("admits nothing is near past 100 km", () => {
    nearMe(SALAMANCA.lat, SALAMANCA.lon);
    expect(screen.getByText("cityPage.indexNoneNearby")).toBeTruthy();
    expect(screen.queryByText(/indexNearestDistance/)).toBeNull();
  });
});

describe("the chip and the index round the same", () => {
  // §4.4: the same pair of coordinates must not read 188 km on one screen and 189 on
  // the other. Both must be Math.round(haversineKm(...)).toLocaleString(locale).
  it("prints the same integer for the same pair of coordinates", () => {
    const expected = Math.round(haversineKm(NAPLES.lat, NAPLES.lon, 41.9, 12.5));
    expect(expected).toBe(188);

    nearMe(NAPLES.lat, NAPLES.lon);
    expect(screen.getByText(`${expected.toLocaleString("en")} km`)).toBeTruthy();
    cleanup();

    render(<CityPageLink lat={NAPLES.lat} lon={NAPLES.lon} />);
    expect(kmArg(screen.getByRole("link").textContent ?? "")).toBe(expected.toLocaleString("en"));
  });
});
