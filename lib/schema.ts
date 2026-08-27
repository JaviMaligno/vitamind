import { SITE_URL } from "@/lib/site";
import { REFERENCES } from "@/lib/references";
import { DOY_REFERENCE_YEAR } from "@/lib/solar";
import { tzOffsetForDate, zoneOffsetAtLocalHour } from "@/lib/timezone";
import { cityUrl, indexUrl } from "@/lib/city-routes";
import { getPathname } from "@/i18n/navigation";
import type { routing } from "@/i18n/routing";
import type { City } from "@/lib/types";

/**
 * The site's JSON-LD identity graph.
 *
 * Search Console's Search Appearance report read "Sin datos" on 2026-08-09: the
 * FAQPage markup the site already served earned no enhanced appearance at all.
 * Markup without an entity behind it is an assertion nothing can verify. The
 * small competitor Google does cite for the same queries (alpenglowapp.com)
 * serves exactly this and little else: an Organization, a Person, and an
 * `author` edge between them, all on stable `@id`s.
 *
 * Stable `@id`s are the point. They are what lets separate pages refer to the
 * same entity instead of each re-declaring an anonymous one.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#author`;
/** The app node every page-level block hangs off via `isPartOf`. */
export const WEBAPP_ID = `${SITE_URL}/#webapp`;

const AUTHOR_NAME = "Javier Aguilar";
const AUTHOR_PROFILES = ["https://javieraguilar.ai", "https://github.com/JaviMaligno"];

/** A healthcare professional who has reviewed the medical copy. */
export interface Reviewer {
  name: string;
  jobTitle: string;
  url?: string;
}

/**
 * Set this when a clinician actually reviews the content — and not before.
 * Claiming review that did not happen is the one failure mode worse than
 * having no reviewer at all.
 */
export const MEDICAL_REVIEWER: Reviewer | null = null;

export interface SiteGraphInput {
  locale: string;
  description: string;
  /** Defaults to the module constant; injectable so the absent case is testable. */
  reviewer?: Reviewer | null;
}

// The graph is data, not a typed schema.org model: a loose node type keeps the
// builders readable without pulling in a dependency for one file.
type Node = Record<string, unknown> & { "@type": string };

export function siteGraph({
  locale,
  description,
  reviewer = MEDICAL_REVIEWER,
}: SiteGraphInput): { "@context": string; "@graph": Node[] } {
  const organization: Node = {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Vitamina D Explorer",
    url: SITE_URL,
    founder: { "@id": PERSON_ID },
  };

  const person: Node = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: AUTHOR_NAME,
    url: `${SITE_URL}/about`,
    sameAs: AUTHOR_PROFILES,
  };

  const application: Node = {
    "@type": "WebApplication",
    "@id": WEBAPP_ID,
    name: "Vitamina D Explorer",
    url: SITE_URL,
    description,
    applicationCategory: "HealthApplication",
    operatingSystem: "Any",
    inLanguage: locale,
    author: { "@id": PERSON_ID },
    publisher: { "@id": ORGANIZATION_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    featureList:
      "Real-time UV synthesis windows, Personalized skin type calculator, 5-day forecast, Global heatmap, Push notifications, Multi-language support",
    ...(reviewer ? { reviewedBy: reviewerNode(reviewer) } : {}),
  };

  return { "@context": "https://schema.org", "@graph": [organization, person, application] };
}

/**
 * The attribution edges every other JSON-LD block on the site should carry.
 *
 * Spread into a page's own node (`{ "@type": "FAQPage", ...authorship() }`) so
 * that block points at the same entities the root graph declares instead of
 * standing alone. A FAQPage naming no author says a question was answered, not
 * who answered it.
 */
export function authorship(): { author: { "@id": string }; publisher: { "@id": string } } {
  return { author: { "@id": PERSON_ID }, publisher: { "@id": ORGANIZATION_ID } };
}

/**
 * `citation` edges for the methodology page — the one place that states the
 * bibliography. Data pages link to it rather than repeating 51 nodes each,
 * which on 3360 pages would be weight without information.
 */
export function modelCitations(): { citation: { "@type": string; name: string; url: string }[] } {
  return {
    citation: Object.values(REFERENCES).map((r) => ({
      "@type": "ScholarlyArticle",
      name: r.label,
      url: r.url,
    })),
  };
}

function reviewerNode(reviewer: Reviewer): Node {
  return {
    "@type": "Person",
    name: reviewer.name,
    jobTitle: reviewer.jobTitle,
    ...(reviewer.url ? { url: reviewer.url } : {}),
  };
}

/* ------------------------------------------------------------------------- *
 * The sunrise/sunset month pages
 * ------------------------------------------------------------------------- */

/**
 * A sunrise page used to serve a lone FAQPage: two answers floating with nothing
 * behind them. The competitor Google does cite for these queries
 * (alpenglowapp.com/es/times/madrid) serves the structure instead — the city as a
 * Place, the page as a WebPage about that Place, a trail up to it, and the sun
 * events as Events. That is what makes the page a statement about a known entity
 * rather than a page that happens to contain times.
 *
 * Only nodes whose every field is already computed and rendered by the page are
 * built here. Solstices and equinoxes are deliberately absent: alpenglow emits
 * them to the second and we have no exact solstice calculation — `city-content`
 * only carries approximate representative day numbers — and a timestamp we did
 * not compute is exactly the kind of claim this repo has shipped wrong before.
 */

/** One day's stated figures, in local decimal hours (5.4 = 05:24), null on polar day/night. */
export interface SunDayFigures {
  /** Day of the month, 1-based. */
  day: number;
  sunrise: number | null;
  sunset: number | null;
  /**
   * Localised one-liners for the Event `description`, built by the page because
   * only it has the translator.
   *
   * They name the compass point and deliberately not the bearing in degrees.
   * `declination()` is a one-term approximation whose error reaches 2.33 degrees
   * at the latitudes we ship, which the visible page discloses in a note next to
   * the figure — a description field has nowhere to put that note, and a bare
   * "71°" would claim a precision the model does not have. An eight-point sector
   * is 45 degrees wide and absorbs the error.
   *
   * Absent on polar days, where there is no direction and no Event either.
   */
  sunriseDescription?: string;
  sunsetDescription?: string;
}

export interface SunPageGraphInput {
  city: City;
  /** Unlocalised city slug ("madrid"). Anchors the Place `@id` across months and locales. */
  base: string;
  /** The city's name in this page's locale — what the page prints. */
  cityName: string;
  locale: string;
  /** 0-based month index, matching `dailySunTimes`. */
  monthIndex: number;
  /** The page's canonical URL. */
  url: string;
  /** The page's own heading, reused verbatim as the WebPage name and last crumb. */
  pageName: string;
  /**
   * Labels lifted from strings the page already renders. Passing them in keeps
   * this builder out of `messages/*.json`: the graph introduces no new copy, so
   * it cannot drift from the visible text or disturb a running copy experiment.
   */
  labels: { sunrise: string; sunset: string; cities: string };
  /**
   * Localised names for the Event's `performer` and `organizer`. Optional so the
   * builder stays usable without them, and so their absence is testable.
   */
  credits?: { organizer: string; performer: string };
  /** The days the page states in its intro — first and last of the month. */
  days: readonly SunDayFigures[];
  /** The Question nodes the page already builds, passed through unchanged. */
  faq: readonly Record<string, unknown>[];
}

/**
 * The Place `@id` for a city, keyed on the unlocalised slug rather than on the
 * page URL. 12 months × 6 locales all describe one Madrid; giving each page its
 * own Place would declare 72 of them.
 */
export function cityPlaceId(base: string): string {
  return `${SITE_URL}/#place-${base}`;
}

export function sunPageGraph({
  city, base, cityName, locale, monthIndex, url, pageName, labels, credits, days, faq,
}: SunPageGraphInput): { "@context": string; "@graph": Node[] } {
  const placeId = cityPlaceId(base);

  const place: Node = {
    "@type": "Place",
    "@id": placeId,
    // One `@id` is described by six locales. The localised string is the `name`
    // because it is what the page prints; the City record's own name rides along
    // as `alternateName` so the entity is still findable under it.
    name: cityName,
    ...(city.name !== cityName ? { alternateName: city.name } : {}),
    geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lon },
    // Google's Event spec requires `location.address` for a physical location:
    // without it every Event in this graph is invalid and gets dropped, which
    // is the whole point of the graph. `addressLocality` only restates the name
    // the Place already asserts, so it introduces no claim the graph did not
    // already make. `addressCountry` is emitted only where the record carries
    // the field — never decoded from `flag`, since Edinburgh's is a subdivision
    // tag (gbsct) rather than an ISO country code.
    address: {
      "@type": "PostalAddress",
      addressLocality: cityName,
      ...(city.country ? { addressCountry: city.country } : {}),
    },
  };

  const breadcrumbId = `${url}#breadcrumb`;

  const webPage: Node = {
    "@type": "WebPage",
    "@id": url,
    url,
    name: pageName,
    inLanguage: locale,
    about: { "@id": placeId },
    isPartOf: { "@id": WEBAPP_ID },
    breadcrumb: { "@id": breadcrumbId },
    ...authorship(),
  };

  // The page-level nodes reference each other by `@id`. Left unidentified, the
  // FAQPage is a second anonymous page-level node describing the same URL as the
  // WebPage — the exact ambiguity stable `@id`s exist to remove.
  const breadcrumb: Node = {
    "@type": "BreadcrumbList",
    "@id": breadcrumbId,
    itemListElement: breadcrumbTrail({ locale, base, cityName, pageName, url, labels }).map(
      (crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: crumb.item }),
    ),
  };

  const events = days.flatMap((d) => {
    // `getSunTimes` returns `wrap24(...)`, so a sunset that genuinely falls after
    // local midnight comes back as a small number and would be stamped on the day
    // before — an instant 24 h out. It fires for no city currently shipped; it
    // fires at the latitudes SUNRISE_CITIES is growing toward (Tromso, 69.65 N,
    // is named as pending in lib/sun-routes.ts).
    const sunsetPastMidnight = d.sunrise !== null && d.sunset !== null && d.sunset < d.sunrise;
    return [
      sunEvent({ city, monthIndex, day: d.day, hours: d.sunrise, kind: "sunrise", label: labels.sunrise, cityName, url, placeId, description: d.sunriseDescription, credits }),
      sunEvent({ city, monthIndex, day: d.day, dateDay: d.day + (sunsetPastMidnight ? 1 : 0), hours: d.sunset, kind: "sunset", label: labels.sunset, cityName, url, placeId, description: d.sunsetDescription, credits }),
    ];
  }).filter((e): e is Node => e !== null);

  const faqPage: Node = { "@type": "FAQPage", "@id": `${url}#faq`, isPartOf: { "@id": url }, mainEntity: faq, ...authorship() };

  return { "@context": "https://schema.org", "@graph": [place, webPage, breadcrumb, ...events, faqPage] };
}

/**
 * Home → city index → city → this page.
 *
 * The URL's own ancestors are NOT the trail. `app/[locale]/[cityPrefix]/page.tsx`
 * bails out unless the prefix equals `CITY_PREFIX[locale]`, so `/amanecer` is a
 * 404 and putting it in a BreadcrumbList would advertise a dead URL per page.
 * (`/amanecer/madrid` became a live page — the sunrise tree's city hub — but the
 * trail deliberately stays on the vitamin D city page: that is the canonical
 * entity page for the city, and both sunrise pages link into the hub anyway.)
 */
function breadcrumbTrail({
  locale, base, cityName, pageName, url, labels,
}: Pick<SunPageGraphInput, "locale" | "base" | "cityName" | "pageName" | "url" | "labels">) {
  const home = `${SITE_URL}${getPathname({ href: "/", locale: locale as (typeof routing.locales)[number] })}`;
  return [
    { name: "Vitamina D Explorer", item: home },
    { name: labels.cities, item: indexUrl(locale) },
    { name: cityName, item: cityUrl(locale, base) },
    { name: pageName, item: url },
  ];
}

/**
 * One sunrise or sunset as an Event, or `null` when the page has no figure for
 * it — or, now only in principle, when no offset can be verified for the instant
 * (see `offsetHoldsAtInstant`; it used to fire on every DST transition day and
 * fires for nothing this site publishes).
 *
 * Polar day and night print an em dash on the page; the node is dropped instead
 * of being filled with a plausible-looking instant.
 *
 * The vocabulary this borrows was written for concerts. Each optional property
 * below carries the argument for why it is true of a sunrise; none is emitted
 * because a competitor emits it.
 */
function sunEvent({
  city, monthIndex, day, dateDay = day, hours, kind, label, cityName, url, placeId, description, credits,
}: {
  city: City;
  monthIndex: number;
  /** The day the page states the figure under. */
  day: number;
  /**
   * The calendar day the instant belongs to — `day + 1` for a sunset past
   * midnight — and therefore the day the offset is probed on.
   */
  dateDay?: number;
  hours: number | null;
  kind: "sunrise" | "sunset";
  label: string;
  cityName: string;
  url: string;
  placeId: string;
  description?: string;
  credits?: { organizer: string; performer: string };
}): Node | null {
  if (hours === null) return null;
  // `dateDay`, not `day`: the offset belongs to the instant, and a sunset past
  // local midnight is an instant on the following calendar day. `localInstant`
  // stamps the same day, so the two cannot disagree about which one it is.
  const offset = utcOffsetHours(city, monthIndex, dateDay, hours);
  const startDate = localInstant(hours, monthIndex, dateDay, offset);
  if (!offsetHoldsAtInstant(city, startDate, offset)) return null;
  return {
    "@type": "Event",
    "@id": `${url}#${kind}-${startDate.slice(0, 10)}`,
    name: `${label} — ${cityName}`,
    startDate,
    location: { "@id": placeId },
    // Omitted rather than emitted empty when the page could not build one.
    ...(description ? { description } : {}),
    /**
     * Scheduled, in the most literal sense the vocabulary allows: orbital
     * mechanics. More reliable than any concert this property was written for.
     * Clouds do not cancel a sunrise — they cancel the spectacle — so nothing
     * here ever becomes EventCancelled.
     */
    eventStatus: "https://schema.org/EventScheduled",
    /**
     * Free, and this is the plainest true statement on the whole page: watching
     * the sun come up costs nothing. `price: "0"` with InStock is exactly what
     * Offer means, not a workaround for an empty field.
     */
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url,
    },
    /**
     * In person, which is the only way to attend one. The alternative values
     * describe streaming, and nobody streams the sunrise as the event itself.
     */
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    /**
     * Plain strings, not `{"@type": "Person"}` nodes.
     *
     * `performer` and `organizer` range over Person and Organization and nothing
     * else — checked against schema.org, which has no type for a celestial body
     * or for anything else these two are. Emitting a Person node would assert
     * that the sun is a person, which is false; a literal only names it and
     * asserts no type at all. Naming them stretches a vocabulary written for
     * concerts either way, and that is the owner's call: a first cause and a
     * mechanical explanation are not in competition, which is why the rest of
     * this site cites 51 papers without contradiction.
     */
    ...(credits ? { performer: credits.performer, organizer: credits.organizer } : {}),
    /**
     * The page's own share card, rendered from this city and this month.
     *
     * This was the last field left empty, because filling it meant carrying a
     * picture the page does not show — which Google's structured-data policy
     * warns against. A card generated from the page's own figures is not that.
     *
     * Derived from the canonical rather than from the locale segment: Next
     * builds its own image URL as /es/amanecer/... and the proxy redirects that
     * to the unprefixed path, so the inferred one answers 307. The page states
     * this same URL in og:image for the same reason.
     */
    image: `${url}/opengraph-image`,
  };
}

/**
 * The offset in force at the moment the page's clock time designates — not the
 * offset the day happened to start in.
 *
 * `City.tz` is a fixed number that ignores DST — Madrid is `tz: 1` in the record
 * and sits at +02:00 for all of August — so publishing it as the offset of an
 * instant would be wrong for roughly half the year in most of the city list.
 * Probing the zone fixes that for 363 days a year. The other two are why this
 * function takes `hours` at all.
 *
 * WHAT THIS USED TO DO AND WHY IT CHANGED. The probe read the zone at UTC
 * midnight of the stated day and applied that one answer to both events. On a
 * day when the zone changes offset the day's start and the sunrise sit on
 * opposite sides of the transition, so the label named an offset the zone was no
 * longer in — "2026-11-01T06:26:00-05:00" for America/Chicago, at a moment the
 * zone is already at -06:00. Rather than publish that, `sunEvent` dropped the
 * node: 12 of the 1920 Event nodes the shipped 40 cities × 12 months produce, on
 * the 6 city-months where a transition lands on the first or last day of the
 * month, which is 36 pages once the six locales are counted. Silence was the
 * safe answer to a wrong label, but it was never the right one — an Event on
 * these pages is the whole point of the graph.
 *
 * The half of the pair that made silence unnecessary landed first:
 * `lib/sun-times.ts` places each printed time with the offset in force at that
 * event's own instant. Probing the same instant here closes the pair, and the
 * label the reader's clock would show and the label the markup carries are once
 * again two presentations of one instant.
 *
 * `zoneOffsetAtLocalHour` is reused rather than reimplemented: this is the wall
 * clock → instant direction (we hold "06:26 on 1 November" and want the offset),
 * which needs two probes, not the one `tzOffsetForDate` takes. Its own comment
 * carries the argument for why two are enough, and the one hour a year where the
 * question has no answer at all — a hour that sits between local midnight and
 * 03:00, where no sunrise or sunset this site publishes falls. `sunEvent` still
 * verifies the answer before emitting it, so the pathological case degrades to
 * the old silence rather than to a false label.
 *
 * `day` is the calendar day the INSTANT belongs to (`dateDay` at the call site,
 * one past the stated day for a sunset after local midnight), and `Date.UTC` is
 * what makes "that day" mean the same thing on every builder. The host-local
 * constructor this used made the probe an instant of the BUILDER's day:
 * `new Date(2026, 10, 1)` is 00:00 UTC on Vercel and 10:00 UTC on a laptop in
 * Honolulu, which is past Chicago's 07:00 UTC transition — so that laptop
 * published the two Events a UTC build dropped, and which nodes a page carries
 * is not allowed to depend on where it was built. With the instant probe both
 * builders now emit the same 1920.
 *
 * With no IANA name we fall back to `City.tz` — which is precisely what
 * `dailySunTimes` falls back to when placing the printed time, so the instant is
 * exactly as accurate as the string beside it and no more. Every builtin city
 * currently carries a zone, so this path is reachable only for records that come
 * from elsewhere.
 */
function utcOffsetHours(city: City, monthIndex: number, day: number, hours: number): number {
  if (!city.timezone) return city.tz;
  return zoneOffsetAtLocalHour(city.timezone, Date.UTC(DOY_REFERENCE_YEAR, monthIndex, day), hours);
}

/**
 * Does the offset that produced the wall clock still hold at the instant that
 * wall clock designates?
 *
 * This used to fail twice a year by construction, because the offset above was
 * probed at the day's start. It no longer does: the probe reads the event's own
 * instant, so the answer it returns is the one in force there.
 *
 * It is kept, and it is not dead weight. `zoneOffsetAtLocalHour` resolves a wall
 * clock in two probes, and inside the one-hour window a transition creates — the
 * clock that never happens in spring, the one that happens twice in autumn — a
 * wall clock does not name a single instant, so no offset can be verified.
 * Nothing this site publishes falls there (that window sits between local
 * midnight and 03:00 wherever DST is observed, and these nodes are sunrises and
 * sunsets), but the guarantee worth keeping is about the markup, not about the
 * latitudes shipped today: if a figure ever does land in it, the node is dropped
 * rather than labelled with an offset the zone does not hold. A missing Event
 * costs a rich result; a false offset is a claim about a timezone, and this repo
 * has shipped enough claims it could not support.
 *
 * With no IANA name there is no zone to disagree with the fallback, so nothing
 * is skipped.
 */
function offsetHoldsAtInstant(city: City, startDate: string, offsetHours: number): boolean {
  if (!city.timezone) return true;
  return tzOffsetForDate(city.timezone, new Date(startDate)) === offsetHours;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "+02:00" / "-02:30" / "+05:30" — fractional zones and negatives both survive. */
function isoOffset(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 ? "-" : "+"}${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/**
 * Local decimal hours → an ISO 8601 instant.
 *
 * Built from the number, never from `fmtTime`. `fmtTime` rounds the minute
 * without carrying and can emit "20:60", which on the page is ugly and in a
 * startDate is unparseable — so the rounding happens once, in minutes, and the
 * hour falls out of the division. A value that rounds up to 24:00 rolls into the
 * next calendar day, which is what the instant actually is.
 */
function localInstant(hours: number, monthIndex: number, day: number, offsetHours: number): string {
  let minutes = Math.round(hours * 60);
  // UTC accessors throughout: the calendar label must not depend on the timezone
  // of the machine that renders the page (issue #25).
  const date = new Date(Date.UTC(DOY_REFERENCE_YEAR, monthIndex, day));
  if (minutes >= 1440) {
    minutes -= 1440;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const ymd = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  return `${ymd}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00${isoOffset(offsetHours)}`;
}
