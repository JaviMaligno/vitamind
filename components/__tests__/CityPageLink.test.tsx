import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Translations resolve to `namespace.key[arg=value|…]` so assertions depend on the
// KEY the component chose and on the interpolated numbers, not on the message files
// (whose fr/de/ru/lt copy is still pending native translation).
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

import CityPageLink from "@/components/CityPageLink";
import { haversineKm } from "@/lib/nearest-city";

// Same fixtures as lib/__tests__/city-client-links.test.ts, classified against the
// real BUILTIN_CITIES table.
const MADRID = { lat: 40.42, lon: -3.7 };
const GETAFE = { lat: 40.3057, lon: -3.7327 };   // Madrid,  13 km, dLat 0.11 → silent
const NAPLES = { lat: 40.8518, lon: 14.2681 };   // Rome,   188 km, dLat 1.05 → with km
const BILBAO = { lat: 43.2627, lon: -2.9253 };   // Madrid, 323 km, dLat 2.84 → with km
const USHUAIA = { lat: -54.8019, lon: -68.303 }; // Buenos Aires, 2374 km → index
const MID_PACIFIC = { lat: 0, lon: -160 };       // Honolulu, 2381 km → index

const chip = () => screen.getByRole("link");

describe("CityPageLink — state 1: the city itself", () => {
  it("links to the builtin page and names it with no distance", () => {
    render(<CityPageLink cityId="builtin:madrid" lat={MADRID.lat} lon={MADRID.lon} />);
    expect(chip().getAttribute("href")).toBe("/vitamin-d/madrid");
    expect(chip().textContent).toContain("cityPage.viewCityPage");
    expect(chip().textContent).toContain("city=cities.madrid");
    expect(chip().textContent).not.toMatch(/km=/);
  });

  // §4.2: the silent-equivalence branch deliberately reuses viewCityPage. It is the
  // only place the app names a city that is not the one you asked for without
  // qualifying it, and D-4 is the measurement that licenses it.
  it("reuses viewCityPage, with no distance, for a silent equivalent", () => {
    render(<CityPageLink cityId="geonames:3115549" lat={GETAFE.lat} lon={GETAFE.lon} />);
    expect(chip().getAttribute("href")).toBe("/vitamin-d/madrid");
    expect(chip().textContent).toContain("cityPage.viewCityPage");
    expect(chip().textContent).not.toMatch(/km=/);
  });
});

describe("CityPageLink — state 2: a nearby city, with the distance stated", () => {
  it("uses viewNearestCityPage and prints the km", () => {
    render(<CityPageLink cityId="geonames:3172394" lat={NAPLES.lat} lon={NAPLES.lon} />);
    expect(chip().getAttribute("href")).toBe("/vitamin-d/rome");
    const label = chip().textContent ?? "";
    expect(label).toContain("cityPage.viewNearestCityPage");
    expect(label).toContain("city=cities.roma");
    expect(label).toContain("km=188");
  });

  // §4.4: the integer on screen is the shared haversine, rounded — nothing else.
  it("prints exactly Math.round(haversineKm(...))", () => {
    render(<CityPageLink lat={BILBAO.lat} lon={BILBAO.lon} />);
    const expected = Math.round(haversineKm(BILBAO.lat, BILBAO.lon, 40.42, -3.7));
    expect(expected).toBe(323);
    expect(chip().textContent).toContain(`km=${expected}`);
  });

  // It must be legible as ANOTHER city: the old copy said "the full Madrid page" for
  // a user in Bilbao and never mentioned that Madrid is 323 km away.
  it("never reuses the unqualified viewCityPage copy when it is not the user's city", () => {
    render(<CityPageLink lat={BILBAO.lat} lon={BILBAO.lon} />);
    expect(chip().textContent).not.toContain("cityPage.viewCityPage[");
  });
});

describe("CityPageLink — state 3: nothing useful nearby", () => {
  // D-9 + verification contract §8.1. Today the component returns null here.
  it("still renders a link, pointing at the city index", () => {
    render(<CityPageLink lat={USHUAIA.lat} lon={USHUAIA.lon} />);
    expect(chip().getAttribute("href")).toBe("/vitamin-d");
    expect(chip().textContent).toContain("cityPage.viewIndexInstead");
  });

  it("does the same in the middle of the Pacific", () => {
    render(<CityPageLink lat={MID_PACIFIC.lat} lon={MID_PACIFIC.lon} />);
    expect(chip().getAttribute("href")).toBe("/vitamin-d");
    expect(chip().textContent).toContain("cityPage.viewIndexInstead");
  });

  it("never renders nothing, for any of the three states", () => {
    for (const p of [MADRID, GETAFE, NAPLES, BILBAO, USHUAIA, MID_PACIFIC, { lat: 89.9, lon: 0 }]) {
      const { container, unmount } = render(<CityPageLink lat={p.lat} lon={p.lon} />);
      expect(container.querySelector("a")).not.toBeNull();
      unmount();
    }
  });
});
