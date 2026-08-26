import { flagCode } from "./flag";

/**
 * Coarse region grouping for the city directory's region filter. Five buckets
 * (the Americas are merged, and Russia/Turkey follow their European cities —
 * Moscow and Istanbul's European side). Derived from the flag emoji's ISO code
 * so it needs no extra per-city data.
 */
export type Region = "europe" | "americas" | "asia" | "africa" | "oceania";

export const REGION_ORDER: Region[] = ["europe", "americas", "asia", "africa", "oceania"];

const ISO_REGION: Record<string, Region> = {
  // Europe
  is: "europe", fi: "europe", no: "europe", se: "europe", ru: "europe", gb: "europe",
  dk: "europe", ie: "europe", de: "europe", nl: "europe", be: "europe", fr: "europe",
  at: "europe", ch: "europe", hu: "europe", tr: "europe", it: "europe", gr: "europe",
  pt: "europe", pl: "europe", cz: "europe", es: "europe",
  // Americas (North + South + Central)
  ca: "americas", us: "americas", mx: "americas", co: "americas", pe: "americas",
  br: "americas", ar: "americas", cl: "americas", uy: "americas",
  // Asia
  cn: "asia", kr: "asia", jp: "asia", in: "asia", ae: "asia", hk: "asia",
  sg: "asia", th: "asia", tw: "asia", my: "asia",
  // Africa
  eg: "africa", ke: "africa", za: "africa", ng: "africa", ma: "africa",
  // Oceania
  au: "oceania", nz: "oceania",
};

/** Region for a city's flag emoji, or null if unknown. Subdivision flags
 *  (e.g. Scotland "gb-sct") fall back to their country ("gb"). */
export function regionForFlag(flag: string | null | undefined): Region | null {
  const code = flagCode(flag);
  if (!code) return null;
  const iso = code.split("-")[0];
  return ISO_REGION[iso] ?? null;
}
