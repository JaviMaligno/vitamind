import { SITE_URL } from "@/lib/site";

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
    "@id": `${SITE_URL}/#webapp`,
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

function reviewerNode(reviewer: Reviewer): Node {
  return {
    "@type": "Person",
    name: reviewer.name,
    jobTitle: reviewer.jobTitle,
    ...(reviewer.url ? { url: reviewer.url } : {}),
  };
}
