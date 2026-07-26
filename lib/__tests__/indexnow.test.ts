import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  INDEXNOW_KEY,
  INDEXNOW_ENDPOINT,
  MAX_URLS_PER_SUBMISSION,
  keyLocation,
  parseSitemapUrls,
  newUrlsSince,
  buildPayloads,
  submitPayload,
} from "@/lib/indexnow";
import { CANONICAL_HOST, SITE_URL } from "@/lib/site";

const sitemapWith = (...urls: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>2026-07-25</lastmod></url>`).join("\n")}
</urlset>`;

describe("indexnow key", () => {
  // The key is public by design, but it must satisfy the protocol's charset
  // (8-128 chars, alphanumerics and dashes) or every submission 422s.
  it("is a protocol-valid key", () => {
    expect(INDEXNOW_KEY).toMatch(/^[A-Za-z0-9-]{8,128}$/);
  });

  // The classic IndexNow failure: the constant and the file drift apart and
  // every submission starts returning 403 in silence. Fail here instead.
  it("matches the verification file served from public/", () => {
    const file = path.join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`);
    expect(readFileSync(file, "utf8").trim()).toBe(INDEXNOW_KEY);
  });

  it("points keyLocation at that file on the canonical host", () => {
    expect(keyLocation()).toBe(`${SITE_URL}/${INDEXNOW_KEY}.txt`);
    expect(new URL(keyLocation()).host).toBe(CANONICAL_HOST);
  });
});

describe("parseSitemapUrls", () => {
  it("extracts every <loc>", () => {
    const xml = sitemapWith(
      "https://getvitamind.app/",
      "https://getvitamind.app/en",
      "https://getvitamind.app/vitamina-d/madrid",
    );
    expect(parseSitemapUrls(xml)).toEqual([
      "https://getvitamind.app/",
      "https://getvitamind.app/en",
      "https://getvitamind.app/vitamina-d/madrid",
    ]);
  });

  it("tolerates whitespace and newlines inside <loc>", () => {
    const xml = `<urlset><url><loc>
      https://getvitamind.app/learn
    </loc></url></urlset>`;
    expect(parseSitemapUrls(xml)).toEqual(["https://getvitamind.app/learn"]);
  });

  it("decodes XML entities", () => {
    const xml = sitemapWith("https://getvitamind.app/explore?a=1&amp;b=2");
    expect(parseSitemapUrls(xml)).toEqual([
      "https://getvitamind.app/explore?a=1&b=2",
    ]);
  });

  // CI feeds this a snapshot that may be empty (curl failed) or an error page.
  // Returning [] beats throwing: an empty "before" degrades to "submit all".
  it("returns [] for empty or non-sitemap input instead of throwing", () => {
    expect(parseSitemapUrls("")).toEqual([]);
    expect(parseSitemapUrls("<html><body>502 Bad Gateway</body></html>")).toEqual([]);
  });

  it("drops duplicates", () => {
    const xml = sitemapWith("https://getvitamind.app/", "https://getvitamind.app/");
    expect(parseSitemapUrls(xml)).toEqual(["https://getvitamind.app/"]);
  });
});

// The "before" side is the live sitemap XML captured pre-deploy; the "after"
// side is the URL list generated from this commit's own app/sitemap.ts, so no
// CDN cache or purge timing can distort it.
describe("newUrlsSince", () => {
  const before = sitemapWith(
    "https://getvitamind.app/",
    "https://getvitamind.app/en",
  );

  it("returns only URLs absent from the old sitemap, in order", () => {
    const current = [
      "https://getvitamind.app/",
      "https://getvitamind.app/en",
      "https://getvitamind.app/de/sonnenaufgang/london/maerz",
      "https://getvitamind.app/vitamina-d/madrid",
    ];
    expect(newUrlsSince(before, current)).toEqual([
      "https://getvitamind.app/de/sonnenaufgang/london/maerz",
      "https://getvitamind.app/vitamina-d/madrid",
    ]);
  });

  it("returns [] when nothing was added — the normal deploy", () => {
    expect(newUrlsSince(before, parseSitemapUrls(before))).toEqual([]);
  });

  // Submitting a URL means "crawl this". Removals have no place in the payload.
  it("ignores URLs that disappeared", () => {
    expect(newUrlsSince(before, ["https://getvitamind.app/"])).toEqual([]);
  });

  // A failed curl leaves an empty snapshot. Degrading to "submit everything"
  // beats submitting nothing and losing the deploy's new pages.
  it("treats an empty snapshot as everything being new", () => {
    expect(newUrlsSince("", parseSitemapUrls(before))).toEqual([
      "https://getvitamind.app/",
      "https://getvitamind.app/en",
    ]);
  });

  it("deduplicates the current list", () => {
    expect(
      newUrlsSince("", ["https://getvitamind.app/x", "https://getvitamind.app/x"]),
    ).toEqual(["https://getvitamind.app/x"]);
  });
});

describe("buildPayloads", () => {
  it("shapes the protocol payload", () => {
    const payloads = buildPayloads(["https://getvitamind.app/learn"]);
    expect(payloads).toEqual([
      {
        host: CANONICAL_HOST,
        key: INDEXNOW_KEY,
        keyLocation: keyLocation(),
        urlList: ["https://getvitamind.app/learn"],
      },
    ]);
  });

  it("returns no payload for an empty list", () => {
    expect(buildPayloads([])).toEqual([]);
  });

  // Submitting a host you do not control is what gets an IndexNow key revoked.
  it("rejects URLs off the canonical host", () => {
    expect(() =>
      buildPayloads([
        "https://getvitamind.app/learn",
        "https://getvitamind-dev.vercel.app/learn",
      ]),
    ).toThrow(/getvitamind-dev\.vercel\.app/);
  });

  it("rejects non-URL input", () => {
    expect(() => buildPayloads(["/learn"])).toThrow();
  });

  it("batches at the protocol maximum", () => {
    const urls = Array.from(
      { length: MAX_URLS_PER_SUBMISSION + 1 },
      (_, i) => `https://getvitamind.app/p/${i}`,
    );
    const payloads = buildPayloads(urls);
    expect(payloads).toHaveLength(2);
    expect(payloads[0].urlList).toHaveLength(MAX_URLS_PER_SUBMISSION);
    expect(payloads[1].urlList).toEqual([
      `https://getvitamind.app/p/${MAX_URLS_PER_SUBMISSION}`,
    ]);
  });

  it("keeps a full production-sized sitemap in one submission", () => {
    const urls = Array.from(
      { length: 2496 },
      (_, i) => `https://getvitamind.app/p/${i}`,
    );
    expect(buildPayloads(urls)).toHaveLength(1);
  });
});

describe("submitPayload", () => {
  const payload = buildPayloads(["https://getvitamind.app/learn"])[0];

  it("POSTs JSON to the generic IndexNow endpoint", async () => {
    const calls: Array<[string, RequestInit]> = [];
    const fetchStub = async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response("", { status: 200 });
    };

    const result = await submitPayload(payload, fetchStub as unknown as typeof fetch);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(JSON.parse(init.body as string)).toEqual(payload);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  // 403 means the key file is unreachable or wrong — the caller must see it.
  it("reports a rejection without throwing", async () => {
    const fetchStub = async () => new Response("Forbidden", { status: 403 });
    const result = await submitPayload(payload, fetchStub as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toContain("Forbidden");
  });
});
