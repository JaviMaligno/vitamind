import { describe, expect, it } from "vitest";
import { readProfileMeta, normalizeProfile, PROFILE_META_KEY, EXPOSURE_PRESETS, type SunProfile } from "../data";
import { renderProfile, liveEstimate } from "../render";
import { profileStrings, resolveWidgetLocale, WIDGET_LOCALES } from "../i18n";

const profile: SunProfile = { skinType: 3, exposedSkinFraction: 0.25, age: null, targetIU: 1000 };
const wrap = (payload: unknown) => ({ content: [], _meta: { [PROFILE_META_KEY]: payload } });

describe("normalizeProfile", () => {
  it("fills in the four defaults every other tool silently assumes", () => {
    expect(normalizeProfile({})).toEqual({
      skinType: 3, exposedSkinFraction: 0.25, age: null, targetIU: 1000,
    });
  });

  it("clamps rather than trusting whatever arrives", () => {
    expect(normalizeProfile({ skinType: 99 }).skinType).toBe(6);
    expect(normalizeProfile({ skinType: -4 }).skinType).toBe(1);
    expect(normalizeProfile({ exposedSkinFraction: 5 }).exposedSkinFraction).toBe(1);
    expect(normalizeProfile({ age: 900 }).age).toBe(120);
    expect(normalizeProfile({ targetIU: 1 }).targetIU).toBe(100);
  });

  it("keeps an unspecified age as null, not zero — a newborn is not an adult", () => {
    expect(normalizeProfile({}).age).toBeNull();
    expect(normalizeProfile({ age: 0 }).age).toBe(0);
  });
});

describe("readProfileMeta", () => {
  it("reads a well-formed payload", () => {
    const meta = readProfileMeta(wrap({ profile, uvIndex: 7, placeName: "Madrid" }));
    expect(meta?.uvIndex).toBe(7);
    expect(meta?.placeName).toBe("Madrid");
  });

  it("refuses a payload with no UV to compute against", () => {
    expect(readProfileMeta(wrap({ profile }))).toBeNull();
    expect(readProfileMeta(wrap({ profile, uvIndex: "high" }))).toBeNull();
    expect(readProfileMeta(null)).toBeNull();
  });
});

describe("liveEstimate", () => {
  it("needs fewer minutes with more skin exposed", () => {
    const covered = liveEstimate({ ...profile, exposedSkinFraction: 0.1 }, 7).minutes!;
    const swimsuit = liveEstimate({ ...profile, exposedSkinFraction: 0.4 }, 7).minutes!;
    expect(swimsuit).toBeLessThan(covered);
  });

  it("needs more minutes for darker skin, and burns later", () => {
    const fair = liveEstimate({ ...profile, skinType: 1 }, 7);
    const dark = liveEstimate({ ...profile, skinType: 6 }, 7);
    expect(dark.minutes!).toBeGreaterThan(fair.minutes!);
    expect(dark.burnMinutes!).toBeGreaterThan(fair.burnMinutes!);
  });

  it("reports no synthesis rather than a fake number when UV is too low", () => {
    expect(liveEstimate(profile, 1).minutes).toBeNull();
  });

  it("asks for more minutes at a higher target", () => {
    expect(liveEstimate({ ...profile, targetIU: 4000 }, 7).minutes!)
      .toBeGreaterThan(liveEstimate({ ...profile, targetIU: 400 }, 7).minutes!);
  });
});

describe("renderProfile", () => {
  const meta = { profile, uvIndex: 7, placeName: "Madrid" };

  it("shows the empty state when nothing arrived", () => {
    expect(renderProfile({ meta: null, locale: "es" })).toContain("No se recibió");
  });

  it("offers six skin types, four exposures and four targets", () => {
    const html = renderProfile({ meta, locale: "en" });
    expect((html.match(/data-skin=/g) ?? [])).toHaveLength(6);
    expect((html.match(/data-exposure=/g) ?? [])).toHaveLength(EXPOSURE_PRESETS.length);
    expect((html.match(/data-target=/g) ?? [])).toHaveLength(4);
  });

  it("marks exactly one option selected per group", () => {
    const html = renderProfile({ meta, locale: "en" });
    expect((html.match(/aria-pressed="true"/g) ?? [])).toHaveLength(3);
  });

  it("moves the selection when the user's choice differs from the payload", () => {
    const html = renderProfile({
      meta,
      profile: { ...profile, skinType: 6, exposedSkinFraction: 0.4, targetIU: 4000 },
      locale: "en",
    });
    expect(html).toContain('data-skin="6" aria-pressed="true"');
    expect(html).toContain('data-exposure="0.4" aria-pressed="true"');
    expect(html).toContain('data-target="4000" aria-pressed="true"');
  });

  it("shows the live number, and says why when there is none", () => {
    expect(renderProfile({ meta, locale: "en" })).toContain("minutes to your target");
    expect(renderProfile({ meta: { ...meta, uvIndex: 1 }, locale: "en" }))
      .toContain(profileStrings("en").noSun);
  });

  it("names the place it is estimating for", () => {
    expect(renderProfile({ meta, locale: "en" })).toContain("Madrid");
    expect(renderProfile({ meta: { profile, uvIndex: 6 }, locale: "en" })).toContain("UV 6");
  });

  it("keeps a place name from becoming markup", () => {
    const html = renderProfile({ meta: { profile, uvIndex: 6, placeName: "<b>x</b>" }, locale: "en" });
    expect(html).not.toContain("<b>x</b>");
  });
});

describe("widget copy", () => {
  it("translates every label in all six languages", () => {
    for (const locale of WIDGET_LOCALES) {
      const copy = profileStrings(locale);
      expect(copy.title.length, locale).toBeGreaterThan(0);
      expect(copy.exposureLabels, locale).toHaveLength(4);
      expect(copy.exposureLabels.every((l) => l.length > 0), locale).toBe(true);
    }
  });

  it("maps host locales onto what we speak", () => {
    expect(resolveWidgetLocale("fr-CA")).toBe("fr");
    expect(resolveWidgetLocale("zh")).toBe("en");
  });
});
