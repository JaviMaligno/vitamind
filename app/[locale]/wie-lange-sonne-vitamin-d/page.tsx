import {
  suntimeMotherMetadata,
  suntimeMotherParams,
  suntimeMotherRoute,
  type MotherParams,
} from "../_suntime/suntime-route";

/**
 * The "how long in the sun" mother page for `de`: `/wie-lange-sonne-vitamin-d`.
 *
 * Deliberately thin. It exists as a file only because these pages cannot use a
 * dynamic first segment — `app/[locale]/[cityPrefix]/` holds that position and
 * Next allows one slug name per position — so each locale needs a static folder
 * of its own. Everything it renders, and the full argument, lives in
 * ../_suntime/suntime-route.tsx.
 *
 * The name is a literal, not `SUNTIME_PREFIX["de"]`, because it has to agree
 * with the DIRECTORY this file sits in: a value read from the table could drift
 * away from the folder and route nothing. app/__tests__/suntime-pages.test.ts
 * pins the literal to the directory name.
 */
const PREFIX = "wie-lange-sonne-vitamin-d";

/**
 * A pure function of (latitude, DOY_REFERENCE_YEAR, the model) — nothing on the
 * render path reads a clock, so there is nothing for an interval to refresh.
 * Same reason the 438 city pages went static on 2026-08-22.
 */
export const revalidate = false;

export function generateStaticParams() {
  return suntimeMotherParams(PREFIX);
}

export async function generateMetadata({ params }: { params: Promise<MotherParams> }) {
  return suntimeMotherMetadata(PREFIX, params);
}

export default async function SuntimeMotherRoute({ params }: { params: Promise<MotherParams> }) {
  return suntimeMotherRoute(PREFIX, params);
}
