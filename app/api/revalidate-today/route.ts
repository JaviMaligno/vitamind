import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { SUNRISE_CITIES, sunCityUrl } from "@/lib/sun-routes";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

/**
 * Refreshes the today hubs on a schedule, because ISR alone cannot keep them true.
 *
 * ISR regenerates on request: when `revalidate` has elapsed, the NEXT reader is
 * served the stale copy while regeneration happens behind them. A page nobody
 * fetches is never regenerated, so a crawler that visits monthly always reads
 * what its own previous visit generated — a month old. For 240 new low-traffic
 * URLs that is the normal case, not the edge case.
 *
 * That matters here and not on the month pages because the hub's subject is
 * today. Over weeks the synthesis window drifts by the full seasonal amplitude
 * and can invert outright: Oslo has a midday window in August and none in
 * September. Stale HTML would then assert that skin synthesises vitamin D at
 * hours when it does not.
 *
 * Pushing the regeneration from a cron bounds the age of the served HTML at one
 * day. At one day the window moves by at most an hour and the regime cannot
 * flip, so the figure is at worst slightly early or late, never false. The
 * browser still corrects it on mount for anyone running JavaScript; this is what
 * protects the readers who do not, which includes the machines we want to be
 * quoted by.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One concrete localized path per hub, never the `[locale]/[cityPrefix]/[city]`
  // template: the template would also sweep the 438 vitamin D city pages that
  // share the segment, whose content does not depend on the day.
  const paths = routing.locales.flatMap((locale) =>
    SUNRISE_CITIES.map((base) => sunCityUrl(locale, base).slice(SITE_URL.length)),
  );

  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: paths.length });
}
