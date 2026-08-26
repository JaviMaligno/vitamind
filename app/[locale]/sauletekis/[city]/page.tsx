import { sunHubMetadata, sunHubPage, sunHubStaticParams, type HubParams } from "../../_sun-hub/hub-route";

/**
 * The today hub for the `lt` sunrise prefix: `/sauletekis/{city}`.
 *
 * Deliberately thin. Its only reason to exist as a file is that route segment
 * config is per file: this folder carries an interval that the 438 vitamin D
 * city pages under `[cityPrefix]/[city]` must NOT inherit, and a static route
 * segment outranks that dynamic sibling. Everything it renders, and the full
 * argument for the split plus the test that keeps these six folder names tied to
 * SUN_PREFIX, lives in ../../_sun-hub/hub-route.tsx.
 *
 * The name is a literal, not `SUN_PREFIX["lt"]`, because it has to agree with
 * the DIRECTORY this file sits in — a value read from the table could drift away
 * from the folder and route nothing. The test pins the literal to the directory.
 */
const PREFIX = "sauletekis";

/**
 * Daily, unchanged, and still paired with the cron at /api/revalidate-today.
 * The freshness argument is that route's and lib/sun-today.ts's: ISR regenerates
 * only on request, so the cron is what actually bounds the age of a hub's HTML
 * and this interval is the backstop for the cron failing. What the split changed
 * is only WHO pays for it — 40 hubs per locale instead of 678 mixed pages.
 */
export const revalidate = 86400;

export function generateStaticParams() {
  return sunHubStaticParams(PREFIX);
}

export async function generateMetadata({ params }: { params: Promise<HubParams> }) {
  return sunHubMetadata(PREFIX, params);
}

export default async function SunHubRoute({ params }: { params: Promise<HubParams> }) {
  return sunHubPage(PREFIX, params);
}
