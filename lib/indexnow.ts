/**
 * IndexNow — tell search engines which URLs changed instead of waiting to be
 * crawled. Bing, Yandex, Seznam and Naver share the protocol; Google does not
 * participate (its sitemap is resubmitted by hand in Search Console).
 *
 * Why it matters here: with 7 external links from 2 domains, Google crawls this
 * domain slowly. Bing indexes new domains with far less authority, and Bing is
 * the index behind ChatGPT and Copilot — being in it is what lets a
 * search-enabled LLM cite getvitamind.app.
 *
 * This module is pure: it parses, diffs, batches and submits. Producing the
 * current URL list is the caller's job (`scripts/indexnow.ts` reads it straight
 * from `app/sitemap.ts`), so nothing here depends on Next or on the network.
 */

import { CANONICAL_HOST, SITE_URL } from "@/lib/site";

/**
 * The IndexNow key. Public by design: the search engine fetches it from
 * `keyLocation()` to confirm whoever submitted controls the domain. The worst a
 * third party can do with it is trigger crawls of already-public pages.
 *
 * It must stay byte-identical to the contents of `public/<key>.txt` — the pair
 * drifting apart makes every submission return 403 in silence, which is why
 * `lib/__tests__/indexnow.test.ts` asserts they match.
 */
export const INDEXNOW_KEY = "8fb0929875019a6c7a5569a501de725d";

/** The generic endpoint fans a submission out to every participating engine. */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Protocol maximum per submission. */
export const MAX_URLS_PER_SUBMISSION = 10_000;

/** Where the engine looks for the key file. */
export function keyLocation(): string {
  return `${SITE_URL}/${INDEXNOW_KEY}.txt`;
}

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export type SubmitResult = {
  ok: boolean;
  status: number;
  body: string;
};

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
}

/**
 * Extracts the `<loc>` values of a sitemap, deduplicated and in document order.
 *
 * Returns `[]` for empty or non-sitemap input rather than throwing: CI feeds
 * this a snapshot that may be empty (curl failed) or an error page, and an empty
 * "before" must degrade to "everything is new", not crash the step.
 */
export function parseSitemapUrls(xml: string): string[] {
  const urls = new Set<string>();
  const locPattern = /<loc>([\s\S]*?)<\/loc>/g;

  let match: RegExpExecArray | null;
  while ((match = locPattern.exec(xml)) !== null) {
    const url = decodeXmlEntities(match[1].trim());
    if (url) urls.add(url);
  }

  return [...urls];
}

/**
 * URLs in `currentUrls` that the previous sitemap did not have.
 *
 * Removals are deliberately not reported: submitting a URL means "crawl this",
 * so a deleted page has nothing to submit.
 */
export function newUrlsSince(beforeXml: string, currentUrls: string[]): string[] {
  const known = new Set(parseSitemapUrls(beforeXml));
  const fresh = new Set<string>();

  for (const url of currentUrls) {
    if (!known.has(url)) fresh.add(url);
  }

  return [...fresh];
}

/**
 * Validates the URLs and batches them into protocol-sized payloads.
 *
 * Throws on anything not on the canonical host. Submitting a domain you do not
 * control with your own key is what gets an IndexNow key revoked, so this is a
 * hard failure rather than a filter — a stray host means the caller built the
 * list wrong and should be fixed, not silently trimmed.
 */
export function buildPayloads(urls: string[]): IndexNowPayload[] {
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      throw new Error(`IndexNow: not an absolute URL: ${url}`);
    }
    if (host !== CANONICAL_HOST) {
      throw new Error(
        `IndexNow: refusing to submit ${url} — host ${host} is not ${CANONICAL_HOST}`,
      );
    }
  }

  const payloads: IndexNowPayload[] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_SUBMISSION) {
    payloads.push({
      host: CANONICAL_HOST,
      key: INDEXNOW_KEY,
      keyLocation: keyLocation(),
      urlList: urls.slice(i, i + MAX_URLS_PER_SUBMISSION),
    });
  }
  return payloads;
}

/**
 * POSTs one payload. Returns the outcome instead of throwing on a rejection:
 * a 403 (unreachable or wrong key file) is information the caller must log,
 * and in CI a failed ping must not be indistinguishable from a crash.
 */
export async function submitPayload(
  payload: IndexNowPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}
