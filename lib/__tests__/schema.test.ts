import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  ORGANIZATION_ID, PERSON_ID, WEBAPP_ID,
  siteGraph, authorship, modelCitations, sunPageGraph, cityPlaceId,
} from "@/lib/schema";
import { REFERENCES } from "@/lib/references";
import { SITE_URL } from "@/lib/site";
import { BUILTIN_CITIES } from "@/lib/cities";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { dailySunTimes } from "@/lib/sun-times";
import { fmtTime } from "@/lib/solar";
import type { City } from "@/lib/types";

const originalTz = process.env.TZ;
afterAll(() => {
  // Assigning `undefined` to an env var stores the STRING "undefined", which
  // resolves to Etc/Unknown, and vitest reuses a worker across files. CI leaves
  // TZ unset, so this is the normal path rather than the edge case.
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const nodeOfType = (graph: ReturnType<typeof siteGraph>, type: string) =>
  graph["@graph"].find((n) => n["@type"] === type);

const nodesOfType = (graph: ReturnType<typeof siteGraph>, type: string) =>
  graph["@graph"].filter((n) => n["@type"] === type);

describe("siteGraph", () => {
  it("emits Organization, Person and WebApplication in one graph", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"].map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["Organization", "Person", "WebApplication"]),
    );
  });

  it("gives the entity nodes stable @ids anchored to the canonical host", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(nodeOfType(g, "Organization")!["@id"]).toBe(`${SITE_URL}/#organization`);
    expect(nodeOfType(g, "Person")!["@id"]).toBe(`${SITE_URL}/#author`);
    expect(ORGANIZATION_ID).toBe(`${SITE_URL}/#organization`);
    expect(PERSON_ID).toBe(`${SITE_URL}/#author`);
  });

  it("attributes the application to the Person and publishes it under the Organization", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "WebApplication")!;
    expect(app.author).toEqual({ "@id": PERSON_ID });
    expect(app.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("points the Person at the about page and their other profiles", () => {
    const person = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "Person")!;
    expect(person.url).toBe(`${SITE_URL}/about`);
    // Cast: graph nodes are Record<string, unknown>, and `toContain` needs an
    // array type to typecheck.
    expect(person.sameAs as string[]).toContain("https://javieraguilar.ai");
  });

  it("carries the locale and description it was given", () => {
    const app = nodeOfType(siteGraph({ locale: "fr", description: "la desc" }), "WebApplication")!;
    expect(app.inLanguage).toBe("fr");
    expect(app.description).toBe("la desc");
  });

  it("omits reviewedBy while no reviewer exists", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "d" }), "WebApplication")!;
    expect(app.reviewedBy).toBeUndefined();
    expect(JSON.stringify(siteGraph({ locale: "es", description: "d" }))).not.toContain("reviewedBy");
  });

  it("emits reviewedBy once a reviewer is supplied", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dra. Ejemplo", jobTitle: "Dermatóloga", url: "https://example.org/dra" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({
      "@type": "Person",
      name: "Dra. Ejemplo",
      jobTitle: "Dermatóloga",
      url: "https://example.org/dra",
    });
  });

  it("emits a reviewer without a url, since not every clinician has a public profile", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dr. Ejemplo", jobTitle: "Endocrino" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({ "@type": "Person", name: "Dr. Ejemplo", jobTitle: "Endocrino" });
    expect(JSON.stringify(app.reviewedBy)).not.toContain("url");
  });
});

describe("authorship", () => {
  it("points at the same entities the root graph declares, by @id", () => {
    expect(authorship()).toEqual({
      author: { "@id": PERSON_ID },
      publisher: { "@id": ORGANIZATION_ID },
    });
  });

  it("spreads into a page node without disturbing it", () => {
    const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [], ...authorship() };
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.author).toEqual({ "@id": PERSON_ID });
  });

  it("declares no anonymous entity of its own", () => {
    // The failure this guards: inlining {"@type":"Person", name:...} per page,
    // which creates a new entity per block instead of referencing the one.
    expect(JSON.stringify(authorship())).not.toContain("@type");
  });
});

describe("modelCitations", () => {
  it("emits one ScholarlyArticle per reference", () => {
    const { citation } = modelCitations();
    expect(citation).toHaveLength(Object.keys(REFERENCES).length);
    expect(citation[0]["@type"]).toBe("ScholarlyArticle");
  });

  it("carries the url of each paper", () => {
    for (const c of modelCitations().citation) expect(c.url).toMatch(/^https:\/\//);
  });
});

/**
 * The sunrise page graph.
 *
 * Every figure asserted here has to be the one the page already renders. The
 * fixtures therefore mirror the real `BUILTIN_CITIES` record for Madrid (lat,
 * lon, tz and the IANA name) rather than round numbers, so a test passing on
 * invented input cannot be mistaken for a test passing on the shipped one.
 */
const MADRID: City = {
  id: "builtin:madrid",
  name: "Madrid",
  lat: 40.42,
  lon: -3.7,
  tz: 1,
  timezone: "Europe/Madrid",
  elevation: 660,
  source: "builtin",
};

const AUGUST = 7;
const JANUARY = 0;

const FAQ = [
  { "@type": "Question", name: "¿A qué hora amanece?", acceptedAnswer: { "@type": "Answer", text: "A las 07:15." } },
  { "@type": "Question", name: "¿Cuánto dura el día?", acceptedAnswer: { "@type": "Answer", text: "13 h 45 min." } },
];

const CANONICAL = `${SITE_URL}/amanecer/madrid/agosto`;

/** The two days the page's intro states: the first and the last of the month. */
const AUGUST_DAYS = [
  { day: 1, sunrise: 7.25, sunset: 21.5 },
  { day: 31, sunrise: 7.75, sunset: 20.75 },
];

function madridAugust(overrides: Partial<Parameters<typeof sunPageGraph>[0]> = {}) {
  return sunPageGraph({
    city: MADRID,
    base: "madrid",
    cityName: "Madrid",
    locale: "es",
    monthIndex: AUGUST,
    url: CANONICAL,
    pageName: "Amanecer y atardecer en Madrid en agosto",
    labels: { sunrise: "Amanecer", sunset: "Atardecer", cities: "Ciudades" },
    days: AUGUST_DAYS,
    faq: FAQ,
    ...overrides,
  });
}

describe("sunPageGraph", () => {
  it("emits Place, WebPage, BreadcrumbList, Event and FAQPage in one graph", () => {
    const g = madridAugust();
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"].map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["Place", "WebPage", "BreadcrumbList", "Event", "FAQPage"]),
    );
  });

  it("carries the description the page built, and omits the field when it built none", () => {
    // The page supplies these because only it has the translator. A sunrise on a
    // polar day has no direction and no Event either, so the absent case here is
    // the one where the page had a sunrise but could not name a direction.
    const withText = nodesOfType(
      madridAugust({ days: [{ day: 1, sunrise: 7.2, sunset: 21.5, sunriseDescription: "El sol sale por el este en Madrid.", sunsetDescription: "El sol se pone por el oeste en Madrid." }] }),
      "Event",
    );
    expect(withText.map((e) => e.description)).toEqual([
      "El sol sale por el este en Madrid.",
      "El sol se pone por el oeste en Madrid.",
    ]);

    const without = nodesOfType(madridAugust({ days: [{ day: 1, sunrise: 7.2, sunset: 21.5 }] }), "Event");
    for (const e of without) expect(e).not.toHaveProperty("description");
    // An empty string would be worse than nothing: it asserts a blank description.
    expect(JSON.stringify(without)).not.toContain('"description"');
  });

  it("states a compass point and never a bearing, which the model cannot back to the degree", () => {
    // declination() is a one-term approximation reaching 2.33 degrees of error at
    // the latitudes we ship. The visible page prints degrees beside a note saying
    // so; a description field has nowhere to put that note.
    const es = JSON.parse(readFileSync("messages/es.json", "utf8"));
    for (const key of ["eventDescriptionSunrise", "eventDescriptionSunset"]) {
      expect(es.sunrisePage[key]).not.toMatch(/°|\{[a-zA-Z]*[Bb]earing\}|\{degrees\}/);
      expect(es.sunrisePage[key]).toContain("{point}");
    }
  });

  it("anchors the Place on a city-level @id, so 12 months x 6 locales mean one entity", () => {
    const es = nodeOfType(madridAugust(), "Place")!;
    const en = nodeOfType(
      madridAugust({ locale: "en", url: `${SITE_URL}/en/sunrise/madrid/august` }),
      "Place",
    )!;
    expect(es["@id"]).toBe(cityPlaceId("madrid"));
    expect(en["@id"]).toBe(es["@id"]);
    expect(es["@id"]).not.toContain("agosto");
  });

  it("gives the Place the coordinates the city record carries, not rounded ones", () => {
    const place = nodeOfType(madridAugust(), "Place")!;
    expect(place.name).toBe("Madrid");
    expect(place.geo).toEqual({ "@type": "GeoCoordinates", latitude: 40.42, longitude: -3.7 });
  });

  it("always gives the Place an address, because Event requires location.address", () => {
    // Without it Google's Event spec rejects the node outright, and the Events
    // are the point of this graph. addressLocality restates Place.name, so it
    // is exactly as well-founded as the name already asserted — no new claim.
    expect(MADRID.country).toBeUndefined();
    const place = nodeOfType(madridAugust(), "Place")!;
    expect(place.address).toEqual({ "@type": "PostalAddress", addressLocality: "Madrid" });
  });

  it("emits addressCountry only for a city record that actually has one", () => {
    // Never derived from `flag`: Edinburgh's is a subdivision tag (gbsct), not
    // an ISO country code, so decoding the emoji is wrong for a shipped city.
    const withFlag = nodeOfType(madridAugust({ city: { ...MADRID, flag: "\u{1F1EA}\u{1F1F8}" } }), "Place")!;
    expect(JSON.stringify(withFlag)).not.toContain("addressCountry");

    const place = nodeOfType(madridAugust({ city: { ...MADRID, country: "ES" } }), "Place")!;
    expect(place.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Madrid",
      addressCountry: "ES",
    });
  });

  it("names the Place in the page's locale and keeps the record's name as alternateName", () => {
    // One @id, six locales: the localised string stays `name` (it is what the
    // page prints) and the City record's name rides along as `alternateName`.
    const newYork: City = { ...MADRID, id: "builtin:nueva-york", name: "Nueva York" };
    const en = nodeOfType(
      madridAugust({
        city: newYork, base: "nueva-york", cityName: "New York", locale: "en",
        url: `${SITE_URL}/en/sunrise/new-york/august`,
      }),
      "Place",
    )!;
    expect(en.name).toBe("New York");
    expect(en.alternateName).toBe("Nueva York");
    expect((en.address as Record<string, unknown>).addressLocality).toBe("New York");
  });

  it("omits alternateName when it would only repeat the name", () => {
    const place = nodeOfType(madridAugust(), "Place")!;
    expect(place.alternateName).toBeUndefined();
  });

  it("identifies the WebPage by its canonical url and points it at the city and the app", () => {
    const page = nodeOfType(madridAugust(), "WebPage")!;
    expect(page["@id"]).toBe(CANONICAL);
    expect(page.url).toBe(CANONICAL);
    expect(page.name).toBe("Amanecer y atardecer en Madrid en agosto");
    expect(page.inLanguage).toBe("es");
    expect(page.about).toEqual({ "@id": cityPlaceId("madrid") });
    expect(page.isPartOf).toEqual({ "@id": WEBAPP_ID });
    expect(page.author).toEqual({ "@id": PERSON_ID });
    expect(page.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("walks the breadcrumb home to city index to city to this page, positions from 1", () => {
    const crumbs = nodeOfType(madridAugust(), "BreadcrumbList")!
      .itemListElement as { "@type": string; position: number; name: string; item: string }[];
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3, 4]);
    expect(crumbs.every((c) => c["@type"] === "ListItem")).toBe(true);
    expect(crumbs.map((c) => c.item)).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/vitamina-d`,
      `${SITE_URL}/vitamina-d/madrid`,
      CANONICAL,
    ]);
    expect(crumbs[2].name).toBe("Madrid");
  });

  it("never puts an /amanecer ancestor in the trail, because no such page exists", () => {
    // `app/[locale]/[cityPrefix]/page.tsx` and `.../[city]/page.tsx` both reject
    // any prefix that is not CITY_PREFIX[locale], so /amanecer and
    // /amanecer/madrid are 404s. The city tree is the real parent.
    const crumbs = nodeOfType(madridAugust(), "BreadcrumbList")!
      .itemListElement as { item: string }[];
    for (const c of crumbs.slice(0, -1)) expect(c.item).not.toContain("/amanecer");
  });

  it("localises the trail with the same prefixes the routes use", () => {
    const g = madridAugust({
      locale: "en",
      url: `${SITE_URL}/en/sunrise/madrid/august`,
      labels: { sunrise: "Sunrise", sunset: "Sunset", cities: "Cities" },
    });
    const crumbs = nodeOfType(g, "BreadcrumbList")!.itemListElement as { name: string; item: string }[];
    expect(crumbs.map((c) => c.item)).toEqual([
      `${SITE_URL}/en`,
      `${SITE_URL}/en/vitamin-d`,
      `${SITE_URL}/en/vitamin-d/madrid`,
      `${SITE_URL}/en/sunrise/madrid/august`,
    ]);
    expect(crumbs[1].name).toBe("Cities");
  });

  it("emits one Event per sunrise and sunset the page states, located at the Place", () => {
    const events = nodesOfType(madridAugust(), "Event");
    expect(events).toHaveLength(4);
    for (const e of events) expect(e.location).toEqual({ "@id": cityPlaceId("madrid") });
    expect(events.map((e) => e.name)).toEqual([
      "Amanecer — Madrid",
      "Atardecer — Madrid",
      "Amanecer — Madrid",
      "Atardecer — Madrid",
    ]);
  });

  it("dates each Event from the numeric hour, on the day the figure belongs to", () => {
    const events = nodesOfType(madridAugust(), "Event");
    // 7.25 decimal hours = 07:15; 21.5 = 21:30.
    expect(events[0].startDate).toBe("2026-08-01T07:15:00+02:00");
    expect(events[1].startDate).toBe("2026-08-01T21:30:00+02:00");
    expect(events[2].startDate).toBe("2026-08-31T07:45:00+02:00");
    expect(events[3].startDate).toBe("2026-08-31T20:45:00+02:00");
  });

  it("labels the instant with the offset the zone is in there, not the record's fixed tz", () => {
    // The whole reason City.tz cannot be used: Madrid is tz=1 in the record and
    // sits at +02:00 for the whole of August. The probe reads the zone at the
    // event's own instant, the same instant `dailySunTimes` reads to place the
    // printed time, so the label and the clock beside it always agree — on a
    // transition day too (see the DST transition tests below).
    expect(MADRID.tz).toBe(1);
    const august = nodesOfType(madridAugust(), "Event");
    const january = nodesOfType(
      madridAugust({ monthIndex: JANUARY, days: [{ day: 1, sunrise: 8.5, sunset: 17.9 }] }),
      "Event",
    );
    expect(august[0].startDate as string).toMatch(/\+02:00$/);
    expect(january[0].startDate as string).toMatch(/\+01:00$/);
  });

  it("falls back to the fixed numeric offset only when there is no IANA name", () => {
    // Same fallback `dailySunTimes` uses to place the clock time, so the instant
    // is exactly as accurate as the time printed beside it — not more.
    const noZone: City = { ...MADRID };
    delete noZone.timezone;
    const events = nodesOfType(madridAugust({ city: noZone }), "Event");
    expect(events[0].startDate).toBe("2026-08-01T07:15:00+01:00");
  });

  it("handles a half-hour zone without mangling the offset", () => {
    const delhi: City = {
      id: "builtin:delhi", name: "Delhi", lat: 28.61, lon: 77.21,
      tz: 5.5, timezone: "Asia/Kolkata", source: "builtin",
    };
    const events = nodesOfType(madridAugust({ city: delhi, base: "delhi", cityName: "Delhi" }), "Event");
    expect(events[0].startDate as string).toMatch(/\+05:30$/);
  });

  it("keeps a negative offset's minutes on the right side of zero", () => {
    const stJohns: City = {
      id: "builtin:st-johns", name: "St John's", lat: 47.56, lon: -52.71,
      tz: -3.5, timezone: "America/St_Johns", source: "builtin",
    };
    const events = nodesOfType(madridAugust({ city: stJohns, base: "st-johns", cityName: "St John's" }), "Event");
    expect(events[0].startDate as string).toMatch(/-02:30$/);
  });

  it("skips the Event rather than inventing an instant when the figure is null", () => {
    // Polar day/night: the page prints an em dash. A node with a made-up
    // timestamp would be worse than no node.
    const events = nodesOfType(
      madridAugust({ days: [{ day: 1, sunrise: null, sunset: null }, { day: 31, sunrise: 7.75, sunset: null }] }),
      "Event",
    );
    expect(events).toHaveLength(1);
    expect(events[0].startDate).toBe("2026-08-31T07:45:00+02:00");
  });

  it("carries the minute into the hour, so the fmtTime 20:60 bug cannot reach a startDate", () => {
    // 20.999 h is 20:59.94. Rounding the minute in place yields "20:60"; on the
    // page that is merely ugly, in a startDate it is unparseable.
    const events = nodesOfType(madridAugust({ days: [{ day: 1, sunrise: 5.999, sunset: 20.999 }] }), "Event");
    expect(events[0].startDate).toBe("2026-08-01T06:00:00+02:00");
    expect(events[1].startDate).toBe("2026-08-01T21:00:00+02:00");
  });

  it("rolls into the next day rather than emitting hour 24", () => {
    // High-latitude summer: sunset lands within a minute of midnight.
    const events = nodesOfType(madridAugust({ days: [{ day: 1, sunrise: 4.0, sunset: 23.999 }] }), "Event");
    expect(events[1].startDate).toBe("2026-08-02T00:00:00+02:00");
  });

  it("labels a transition day with the offset in force at the event, not at the day's start", () => {
    // 1 November 2026, America/Chicago: the clocks go back at 02:00 local, i.e.
    // 07:00 UTC. The day STARTS at -05:00, and both figures below fall after the
    // transition, where the zone is at -06:00. A day-start probe used to read
    // -05:00 for them, which would have published an offset the zone does not
    // hold at that moment, so both nodes were dropped rather than mislabelled —
    // 12 of 1920 nodes across the shipped 40 cities × 12 months, 36 pages.
    // Probing each event's own instant makes the label true, so they ship.
    const chicago: City = {
      id: "builtin:chicago", name: "Chicago", lat: 41.88, lon: -87.63,
      tz: -6, timezone: "America/Chicago", source: "builtin",
    };
    const NOVEMBER = 10;
    const events = nodesOfType(
      madridAugust({
        city: chicago, base: "chicago", cityName: "Chicago",
        // The post-transition figures the corrected `dailySunTimes` prints.
        monthIndex: NOVEMBER, days: [{ day: 1, sunrise: 6.4333, sunset: 16.7833 }],
      }),
      "Event",
    );
    expect(events).toHaveLength(2);
    expect(events[0].startDate).toBe("2026-11-01T06:26:00-06:00");
    expect(events[1].startDate).toBe("2026-11-01T16:47:00-06:00");
  });

  it("keeps the Events of an ordinary day in the same month", () => {
    // The transition day must be the only day whose offset differs from the
    // month's, and it must not become an excuse to relabel the rest.
    const chicago: City = {
      id: "builtin:chicago", name: "Chicago", lat: 41.88, lon: -87.63,
      tz: -6, timezone: "America/Chicago", source: "builtin",
    };
    const events = nodesOfType(
      madridAugust({
        city: chicago, base: "chicago", cityName: "Chicago",
        monthIndex: 10, days: [{ day: 30, sunrise: 6.9333, sunset: 16.35 }],
      }),
      "Event",
    );
    expect(events).toHaveLength(2);
    expect(events[0].startDate as string).toMatch(/-06:00$/);
  });

  it("rolls a sunset that falls past local midnight onto the next calendar day", () => {
    // getSunTimes returns wrap24(...), so a sunset genuinely after midnight
    // comes back as a small number. Emitting it on the stated day would put the
    // instant 24 h off. No shipped city trips this today; Tromso (69.65 N),
    // named as pending in lib/sun-routes.ts, is exactly where it does.
    const events = nodesOfType(
      madridAugust({ days: [{ day: 1, sunrise: 2.5, sunset: 0.5 }] }),
      "Event",
    );
    expect(events[0].startDate).toBe("2026-08-01T02:30:00+02:00");
    expect(events[1].startDate).toBe("2026-08-02T00:30:00+02:00");
  });

  it("rolls a month-end sunset into the following month", () => {
    const events = nodesOfType(
      madridAugust({ days: [{ day: 31, sunrise: 2.5, sunset: 0.5 }] }),
      "Event",
    );
    expect(events[1].startDate).toBe("2026-09-01T00:30:00+02:00");
  });

  it("emits startDates that a date parser actually accepts", () => {
    for (const e of nodesOfType(madridAugust(), "Event")) {
      expect(Number.isNaN(Date.parse(e.startDate as string))).toBe(false);
    }
  });

  it("is scheduled by orbital mechanics and attended in person", () => {
    // Both were absent at first on the reasoning that a sunrise is not the kind
    // of thing these describe. Neither objection survived: a sunrise is
    // scheduled more reliably than any concert the property was written for
    // (clouds cancel the spectacle, not the event), and watching one is
    // attendance in person — the alternative values describe streaming.
    for (const e of nodesOfType(madridAugust(), "Event")) {
      expect(e.eventStatus).toBe("https://schema.org/EventScheduled");
      expect(e.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    }
  });

  it("points image at the page's own card, on the path that answers rather than redirects", () => {
    // Next infers /es/amanecer/... for the image and the proxy 307s that to the
    // unprefixed path, so the inferred URL is a redirect. Markup pointing at a
    // redirect is how a 404 ends up inside structured data.
    for (const e of nodesOfType(madridAugust(), "Event")) {
      expect(e.image).toBe(`${SITE_URL}/amanecer/madrid/agosto/opengraph-image`);
      expect(e.image).not.toContain("/es/");
    }
  });

  it("prices the sunrise at zero, which is the plainest true statement on the page", () => {
    for (const e of nodesOfType(madridAugust(), "Event")) {
      expect(e.offers).toEqual({
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/amanecer/madrid/agosto`,
      });
    }
  });

  it("credits the sun and its author when the page supplies them, and omits both when it does not", () => {
    // performer and organizer take a Person or an Organization and nothing else,
    // so this stretches a vocabulary written for concerts. Deliberate, and the
    // owner's call: a first cause and a mechanical explanation are not rivals.
    const credited = nodesOfType(
      madridAugust({ credits: { organizer: "Dios", performer: "El Sol" } }),
      "Event",
    );
    for (const e of credited) {
      // Literals, not Person nodes: schema.org ranges these over Person and
      // Organization only and has no type for what either of these is, so a node
      // would assert the sun is a person. A string names it and claims no type.
      expect(e.performer).toBe("El Sol");
      expect(e.organizer).toBe("Dios");
      expect(JSON.stringify(e)).not.toContain('"@type":"Person"');
    }

    const plain = JSON.stringify(nodesOfType(madridAugust(), "Event"));
    expect(plain).not.toContain("performer");
    expect(plain).not.toContain("organizer");
  });

  it("carries the FAQ through untouched and attributes it", () => {
    const faqPage = nodeOfType(madridAugust(), "FAQPage")!;
    expect(faqPage.mainEntity).toEqual(FAQ);
    expect(faqPage.author).toEqual({ "@id": PERSON_ID });
    expect(faqPage.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("declares @context once, at the graph root, not per node", () => {
    const g = madridAugust();
    for (const n of g["@graph"]) expect(n["@context"]).toBeUndefined();
  });

  it("wires the page-level nodes together by @id instead of leaving a bag of nodes", () => {
    // A FAQPage with no @id is a second, anonymous page-level node for the same
    // URL — which is what the stable-@id argument exists to avoid.
    const g = madridAugust();
    const page = nodeOfType(g, "WebPage")!;
    const crumbs = nodeOfType(g, "BreadcrumbList")!;
    const faqPage = nodeOfType(g, "FAQPage")!;
    expect(crumbs["@id"]).toBe(`${CANONICAL}#breadcrumb`);
    expect(page.breadcrumb).toEqual({ "@id": `${CANONICAL}#breadcrumb` });
    expect(faqPage["@id"]).toBe(`${CANONICAL}#faq`);
    expect(faqPage.isPartOf).toEqual({ "@id": CANONICAL });
  });
});

/**
 * The same builder, fed the page's own numbers.
 *
 * Every other assertion in this file runs on hand-written fixtures, which pin
 * the builder's behaviour but not the wiring: a page passing the wrong array
 * would break nothing. These two run `dailySunTimes` for a real
 * `SUNRISE_CITIES` member, exactly as `monthData` does in
 * `app/[locale]/[cityPrefix]/[city]/[month]/page.tsx`.
 */
describe("sunPageGraph on real sun-times data", () => {
  const cityRecord = (id: string) => BUILTIN_CITIES.find((c) => c.id === id)!;

  it("emits the wall clock the page prints for the first and last day of the month", () => {
    expect(SUNRISE_CITIES).toContain("madrid");
    const city = cityRecord("builtin:madrid");
    const rows = dailySunTimes(city.lat, city.lon, AUGUST, city.timezone, city.tz);
    const days = [rows[0], rows[rows.length - 1]];
    const events = nodesOfType(madridAugust({ city, days }), "Event");
    expect(events).toHaveLength(4);

    const wall = (e: (typeof events)[number]) => (e.startDate as string).slice(11, 16);
    expect(wall(events[0])).toBe(fmtTime(days[0].sunrise!));
    expect(wall(events[1])).toBe(fmtTime(days[0].sunset!));
    expect(wall(events[2])).toBe(fmtTime(days[1].sunrise!));
    expect(wall(events[3])).toBe(fmtTime(days[1].sunset!));
  });

  it("emits both Events for 1 November in Chicago, on the real day's figures", () => {
    // The DST transition day, end to end: the real `dailySunTimes` row, the real
    // city record, the real graph. Both nodes used to be dropped here, because
    // the offset was probed at the day's start and disagreed with the instant —
    // 12 of 1920 nodes across the 40 cities × 12 months, on the 6 city-months
    // where a transition falls on the first or last day of the month, which is
    // 36 pages once the six locales are counted.
    //
    // Chicago goes back at 02:00 local (07:00 UTC), so the day starts at -05:00
    // and both figures are at -06:00. The label has to be the second one, and it
    // has to be the one the printed table already carries.
    expect(SUNRISE_CITIES).toContain("chicago");
    const city = cityRecord("builtin:chicago");
    const NOVEMBER = 10;
    const rows = dailySunTimes(city.lat, city.lon, NOVEMBER, city.timezone, city.tz);
    const first = rows[0];
    expect(first.day).toBe(1);
    const events = nodesOfType(
      madridAugust({ city, base: "chicago", cityName: "Chicago", monthIndex: NOVEMBER, days: [first] }),
      "Event",
    );
    expect(events).toHaveLength(2);
    for (const e of events) expect(e.startDate as string).toMatch(/-06:00$/);
    // The two surfaces say the same thing: the clock in the instant is the clock
    // the table prints.
    expect((events[0].startDate as string).slice(11, 16)).toBe(fmtTime(first.sunrise!));
    expect((events[1].startDate as string).slice(11, 16)).toBe(fmtTime(first.sunset!));
  });

  it("emits the same graph whatever the host zone", () => {
    // WHICH Events a page carries was once a property of the builder's own
    // machine. The offset probe built its date with the host-local constructor,
    // so `new Date(2026, 10, 1)` is 00:00 UTC on Vercel and 10:00 UTC on a
    // laptop in Honolulu — and Chicago's transition is at 07:00 UTC. The
    // Honolulu build therefore probed -06:00, agreed with the instant, and
    // published the two Events that UTC dropped: measured 1920 nodes there
    // against 1908 under UTC, Atlantic/Canary, Europe/Madrid and
    // Australia/Sydney. Probing the event's instant removes the disagreement at
    // the root — every host now emits the full 1920 — but the property this
    // pins is the one that matters and it is unchanged: the graph is a function
    // of the city and the day, never of where it was built.
    const chicago = cityRecord("builtin:chicago");
    const NOVEMBER = 10;
    const graphIn = (zone: string) => {
      process.env.TZ = zone;
      const rows = dailySunTimes(chicago.lat, chicago.lon, NOVEMBER, chicago.timezone, chicago.tz);
      return JSON.stringify(madridAugust({
        city: chicago, base: "chicago", cityName: "Chicago",
        monthIndex: NOVEMBER, days: [rows[0], rows[rows.length - 1]],
      }));
    };
    const utc = graphIn("UTC");
    for (const zone of ["Atlantic/Canary", "Pacific/Honolulu", "Australia/Sydney"]) {
      expect(graphIn(zone), `${zone} differs from UTC`).toBe(utc);
    }
    // Nothing is dropped any more: the transition day and the ordinary day both
    // contribute their pair.
    expect(nodesOfType(JSON.parse(utc), "Event")).toHaveLength(4);
  });
});
