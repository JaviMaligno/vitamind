import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SUN_MONTH_REVISION, CITY_PAGE_REVISION, type ContentRevision } from "@/lib/content-revision";
import {
  sunMonthParts, cityPageParts, SUN_MONTH_NAMESPACES, CITY_PAGE_NAMESPACES, NAMESPACE_SOURCES,
} from "@/lib/content-fingerprint";

/**
 * THE GUARD THE FROZEN SITEMAP DATES ARE ONLY SAFE BEHIND.
 *
 * `app/sitemap.ts` publishes a declared `lastmod` for the 2880 month pages and
 * the 438 city pages instead of the build clock (see lib/content-revision.ts for
 * why). The hazard that buys: a copy fix or a math fix ships to thousands of
 * pages that the sitemap announces as unchanged, the engines keep serving the
 * snippet they already have, and the wrong number stays in the SERP. CLAUDE.md
 * lists five stale factual claims that lived in production for weeks or months
 * for exactly that class of reason.
 *
 * A date-based check ("bump the date if any message file changed in this commit")
 * cannot close it: it would fire on unrelated commits and be silent on the one
 * that matters, because it never looks at the content. So this test hashes what
 * the two families actually render — copy, city list, printed figures, the
 * reference year — and fails when that hash moves without the declared revision
 * moving with it.
 *
 * It is deliberately loud and deliberately prescriptive. The failure prints the
 * exact block to paste, with today's date already filled in, because the one
 * outcome worse than no guard is a guard whose failure is easier to work around
 * than to satisfy.
 */

const TODAY_UTC = new Date().toISOString().slice(0, 10);

/** The literal source to paste back into lib/content-revision.ts. */
function pasteBlock(constName: string, parts: Record<string, string>): string {
  const lines = Object.entries(parts).map(([key, value]) => {
    // Quote only the keys that need it, so the block reads like the file it
    // replaces rather than like machine output.
    const k = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    return `    ${k}: "${value}",`;
  });
  return [
    `export const ${constName}: ContentRevision = {`,
    `  date: "${TODAY_UTC}",`,
    "  parts: {",
    ...lines,
    "  },",
    "};",
  ].join("\n");
}

/** Part-by-part diff: what moved, what appeared, what disappeared. */
function drift(recorded: Readonly<Record<string, string>>, current: Record<string, string>): string[] {
  const keys = [...new Set([...Object.keys(recorded), ...Object.keys(current)])].sort();
  return keys.flatMap((key) => {
    const was = recorded[key];
    const now = current[key];
    if (was === now) return [];
    if (was === undefined) return [`${key}: NEW (${now})`];
    if (now === undefined) return [`${key}: GONE (was ${was})`];
    return [`${key}: ${was} → ${now}`];
  });
}

function check(
  label: string,
  urlCount: number,
  constName: string,
  revision: ContentRevision,
  current: Record<string, string>,
) {
  const moved = drift(revision.parts, current);

  const message = [
    "",
    `${label} changed, but ${constName} in lib/content-revision.ts did not.`,
    "",
    `WHAT MOVED (${moved.length} of ${Object.keys(current).length} parts):`,
    ...moved.map((line) => `  - ${line}`),
    "",
    "  copy.<locale> = the message namespaces that family's page reads",
    `                  (${label === "The month pages' content" ? SUN_MONTH_NAMESPACES.join(", ") : CITY_PAGE_NAMESPACES.join(", ")})`,
    "  cities        = the city list: identity, geometry, localized names",
    "  figures       = the SOURCE of the modules that compute what they print",
    "  constants     = DOY_REFERENCE_YEAR (and the phase-2 treated set)",
    "",
    `WHY THIS IS BLOCKING: ${urlCount} sitemap URLs are about to ship with`,
    `lastmod ${revision.date}, i.e. announced to Google, Bing, Yandex, Seznam and`,
    "Naver as unchanged. Whatever you just fixed would not be re-crawled, and the",
    "old text would keep being served in the SERP — the failure mode CLAUDE.md",
    "records five times over.",
    "",
    "TO FIX: replace the constant in lib/content-revision.ts with exactly this,",
    "and nothing else (the date is today, UTC):",
    "",
    pasteBlock(constName, current),
    "",
    "If you did NOT intend to change what these pages render, do not paste it —",
    "the diff above is telling you the change reached further than you thought.",
    "",
  ].join("\n");

  expect(moved, message).toEqual([]);
}

describe("content revision guard", () => {
  it("the month pages' declared revision still matches what they render", () => {
    check("The month pages' content", 2880, "SUN_MONTH_REVISION", SUN_MONTH_REVISION, sunMonthParts());
  });

  it("the city pages' declared revision still matches what they render", () => {
    check("The city pages' content", 438, "CITY_PAGE_REVISION", CITY_PAGE_REVISION, cityPageParts());
  });

  /**
   * A `lastmod` in the future is the one malformed value an engine may reject
   * outright, and it is what a hand-typed date gets wrong (a typo'd month, or
   * "tomorrow" while working late in a positive offset). Date-only format is
   * asserted too: `app/sitemap.ts` passes these strings through verbatim.
   */
  it.each([
    ["SUN_MONTH_REVISION", SUN_MONTH_REVISION],
    ["CITY_PAGE_REVISION", CITY_PAGE_REVISION],
  ])("%s declares a plain past-or-present UTC date", (_name, revision) => {
    expect(revision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(revision.date <= TODAY_UTC).toBe(true);
  });

  /**
   * The namespace lists in lib/content-fingerprint.ts are a hand-written mirror
   * of the `getTranslations` calls in the route files. A mirror nobody checks
   * drifts: adding a namespace to a page would silently leave that copy outside
   * the fingerprint, which is the exact hole this guard exists to close.
   *
   * Only the route FILE is scanned, not the components it renders. That is the
   * stated boundary — components on these pages are handed their strings as
   * props, and the two that do translate (`SunTimesPanel`, `NotificationToggle`)
   * read chrome namespaces shared with the app pages, which keep a build-time
   * lastmod and therefore announce their own edits.
   */
  it.each([
    ["sunMonth" as const, SUN_MONTH_NAMESPACES],
    ["cityPage" as const, CITY_PAGE_NAMESPACES],
  ])("the %s namespace list mirrors its route file", (family, declared) => {
    const source = readFileSync(join(process.cwd(), NAMESPACE_SOURCES[family]), "utf8");
    const found = [...source.matchAll(/namespace:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(found.length).toBeGreaterThan(0);
    expect([...new Set(found)].sort()).toEqual([...declared].sort());
  });
});
