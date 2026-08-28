import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { routing } from "@/i18n/routing";
import { shortMonthName } from "@/lib/city-copy";

const ROOT = resolve(__dirname, "../..");

/**
 * ONE PLACE ASKS FOR AN ABBREVIATED MONTH, AND IT IS NOT `Intl`.
 *
 * Lithuanian CLDR returns "01".."12" for an abbreviated month — both `short`
 * and `narrow` — so anything that calls `Intl` for one prints numbers where
 * every other locale prints letters. `lib/city-copy.ts` has owned that
 * exception since the year-profile chart was built (LT_MONTH_LABELS, with its
 * own test), and `shortMonthName` is the way to get it.
 *
 * This tripwire exists because the same mistake was then made twice more,
 * independently, by people who had the fix in the repo already:
 *
 *   - PR #61 (2026-08-27) localised the heatmap's month axis and asked `Intl`
 *     directly, turning "Ene/Feb/Mar" into "01/02/03" in Lithuanian.
 *   - The fmtDate fix (2026-08-28) did the same for the tooltip and the
 *     `/explore` date label, rendering "27 08" — not a date in Lithuanian and
 *     not a month name — and even argued in a comment that this was correct
 *     and "not ours to override".
 *
 * Both were caught in review rather than by a test. This is the test.
 */

const ALLOWED = ["lib/city-copy.ts"];

/** Every source file that could render a month label. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  for (const dir of ["lib", "components", "app", "widgets"]) {
    try {
      walk(join(ROOT, dir));
    } catch {
      /* directory absent in some checkouts — nothing to scan */
    }
  }
  return out;
}

describe("abbreviated month names have one source", () => {
  it("nobody asks Intl for a bare short or narrow month except lib/city-copy.ts", () => {
    // Three things are deliberately NOT matched, each for its own reason:
    //
    //  - `month: "long"`. Lithuanian has real long month names in CLDR, so
    //    `monthName` may and does ask Intl for those.
    //  - An options object that also carries `day` or `year`. That asks for a
    //    whole DATE, and a numeric month inside one is the correct localized
    //    form — `components/AiConnections.tsx` renders "connected since" that
    //    way and must keep doing so. The bug is asking for a month ALONE and
    //    getting a number where a name belongs.
    //  - Comments. lib/solar.ts and lib/city-copy.ts both name the option in
    //    prose while explaining why they do not call it that way, and that
    //    explanation is worth more than a grep that trips over it.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const callsWithOptions = /new Intl\.DateTimeFormat\([^)]*?\{([^}]*)\}/g;
    const asksForABareMonth = (src: string) => {
      for (const match of stripComments(src).matchAll(callsWithOptions)) {
        const opts = match[1];
        if (!/month:\s*["'](short|narrow)["']/.test(opts)) continue;
        if (/\b(day|year)\s*:/.test(opts)) continue;
        return true;
      }
      return false;
    };

    const offenders = sourceFiles()
      .filter((file) => asksForABareMonth(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
      .filter((file) => !ALLOWED.includes(file));

    expect(
      offenders,
      `these ask Intl for an abbreviated month directly, which prints digits in ` +
        `Lithuanian — call shortMonthName() from lib/city-copy.ts instead`,
    ).toEqual([]);
  });

  it("gives every locale letters rather than digits", () => {
    for (const locale of routing.locales) {
      for (let month = 0; month < 12; month++) {
        const label = shortMonthName(locale, month);
        expect(label, `${locale} month ${month + 1}`).toMatch(/\p{L}/u);
        expect(label, `${locale} month ${month + 1} is numeric`).not.toMatch(/^\d+$/);
      }
    }
  });

  it("never leaves a trailing period, whatever the locale appends", () => {
    // ru gives "авг.", lt's own table carries "rugp." — both are stripped, so a
    // fixed-width axis label and a tooltip agree on the shape of the string.
    for (const locale of routing.locales) {
      for (let month = 0; month < 12; month++) {
        expect(shortMonthName(locale, month).endsWith(".")).toBe(false);
      }
    }
  });
});
