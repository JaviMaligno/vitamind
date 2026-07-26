# IndexNow — instant indexing pings for Bing, Yandex, Seznam and Naver

Date: 2026-07-25
Branch: `feat/indexnow` (from `master`)

## Why

The 2026-07-25 Search Console baseline showed the bottleneck is authority and crawl
coverage, not technical SEO: 7 external links from 2 domains, 4 clicks in 90 days,
and a sitemap Google last read on 17/7 with 474 URLs while production already serves
2496. Google crawls a domain with that little authority slowly, and nothing on-site
changes that.

IndexNow is the other lever. Instead of waiting to be crawled, the site tells the
search engine which URLs changed. Bing, Yandex, Seznam and Naver share the protocol
(Google does not participate). Two payoffs:

1. Bing indexes new domains with far less authority than Google demands, so it is a
   traffic channel that does not depend on the backlink profile.
2. Bing is the index behind ChatGPT and Copilot. Being in it is what lets a
   search-enabled LLM cite getvitamind.app — the same thesis as the MCP server by a
   different route.

Bing Webmaster Tools registration and the Google sitemap resubmission were done
manually on 2026-07-25 and are out of scope here.

## Scope

In scope: the IndexNow key and its verification file, the submission logic with unit
tests, a CLI, and the CI wiring that pings only genuinely new URLs after a production
deploy.

Explicitly out of scope: splitting `app/sitemap.ts` into a sitemap index for Google.
That is a separate open decision (whether declaring 2496 URLs helps or dilutes the
crawl budget at the current authority level) and gets its own branch. This work does
not touch `app/sitemap.ts` or `app/robots.ts`.

## Key and domain verification

`lib/indexnow.ts` exports `INDEXNOW_KEY`, a 32-character hex string generated once.
`public/<key>.txt` contains that same string and nothing else. Both are committed.

The key is public by design — the search engine fetches it from the domain to confirm
the submitter controls it. The worst a third party can do with it is trigger crawls of
pages that are already public.

The failure mode worth guarding is the constant and the file drifting apart, which
makes every submission return 403 silently. A unit test reads
`public/<INDEXNOW_KEY>.txt` and asserts its trimmed contents equal `INDEXNOW_KEY`, so
the quality gate catches the drift instead of Bing doing it quietly.

`.gitignore` only excludes `public/sw.js`, so the `.txt` needs no gitignore change.

The other way this fails silently is the locale middleware rewriting the key URL: if
`/<key>.txt` were redirected to `/es/<key>.txt`, the engine would never find the key.
It is not, because `proxy.ts`'s matcher excludes any path containing a dot
(`/((?!api|_next|_vercel|.*\..*).*)`) — the same reason `robots.txt` and
`manifest.json` are served untouched. The file is committed with no trailing newline
(32 bytes exactly, verified in the index) so autocrlf cannot turn it into `…\r\n`.

## Logic — `lib/indexnow.ts`

Pure functions, all covered in `lib/__tests__/indexnow.test.ts`:

- `parseSitemapUrls(xml)` — extracts `<loc>` values from a sitemap, deduplicated and
  in document order. Decodes XML entities; returns `[]` for empty or malformed input
  rather than throwing, because CI feeds it a possibly-empty snapshot.
- `newUrlsSince(beforeXml, currentUrls)` — URLs in the current list that the old
  sitemap did not have, order preserved. Removals are not submitted: IndexNow treats
  a submitted URL as "crawl this", and the pages here are never deleted.
- `buildPayloads(urls)` — throws if any URL is not on `getvitamind.app`, then batches
  into chunks of at most 10 000 (the protocol maximum) shaped as
  `{ host, key, keyLocation, urlList }`. The host check matters: submitting a domain
  you do not control with your key is what gets the key revoked.
- `submitPayload(payload, fetchImpl)` — POSTs JSON to
  `https://api.indexnow.org/indexnow`. The generic endpoint fans out to all
  participating engines, so there is no per-engine call. `fetchImpl` is injected so
  tests never hit the network.

## CLI — `scripts/indexnow.ts`

Run with `tsx`, matching the existing `scripts/seed-cities.ts` pattern.

- `--all` — submit every URL in the sitemap. This is the one-time bootstrap, run
  manually after merge. Legitimate for a site that has never pinged.
- `--before <file>` — submit only the URLs that snapshot lacked. This is what CI uses.
- `--dry-run` — print what would be submitted and call nothing.

Exits 0 with a log line when there is nothing new — the normal outcome of a deploy
that adds no pages, and it must not fail CI. Exits 1 on a rejected batch or bad
arguments.

**Where the current URL list comes from.** Not from the network: the script imports
`app/sitemap.ts` and runs it. Two measurements drove this. First, requesting
`sitemap.xml?cb=<random>` in production returned `x-vercel-cache: HIT` with
`age: 555349` — query strings are not part of the cache key for this prerendered
route, so the planned cache-buster does nothing and a post-deploy read could serve a
stale sitemap. Second, `npx tsx` on `app/sitemap.ts` produces 2496 URLs that match
the deployed sitemap exactly (verified: `--before <live sitemap>` reports 0 new).
Generating locally is therefore both exact and free of any race against cache purging.

The `--before` snapshot stays remote, and there the cache works in our favour: Vercel
purges the edge cache per deploy (the `age` above equals the time since the last
production deploy), so a read taken just before deploying is precisely the previous
deploy's sitemap.

## CI — `deploy-prod` in `.github/workflows/ci.yml`

```yaml
- name: Snapshot the live sitemap (pre-deploy)
  run: |
    curl -sf https://getvitamind.app/sitemap.xml -o /tmp/sitemap-before.xml \
      || printf '' > /tmp/sitemap-before.xml

- name: Deploy to Vercel (production)   # existing step

- uses: actions/setup-node@v4
  with: { node-version: 22, cache: npm }

- name: Ping IndexNow with the new URLs
  continue-on-error: true
  run: |
    npm ci
    npx tsx scripts/indexnow.ts --before /tmp/sitemap-before.xml
```

Deliberate details:

The `|| printf '' >` fallback leaves an empty snapshot when the curl fails, which
degrades to "submit everything" instead of breaking the deploy. `setup-node` + `npm ci`
come *after* the deploy so the deploy is not delayed by ~40 s of install; `npm ci` sits
inside the `continue-on-error` step so a failed install cannot red-mark a deploy that
already succeeded. The alternative to installing at all — a dependency-free `.mjs`
runnable with bare `node` — would put the logic outside the Vitest run and duplicate
the sitemap generation. The 40 s is the better trade.

**Both run bodies must be block scalars.** The first version wrote the snapshot as a
plain inline `run: … || : > file`, and the `: ` inside it made the whole workflow file
invalid YAML — GitHub reported "This run likely failed because of a workflow file
issue" in 0 s and, worse, silently ran no CI at all. Validate with
`python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` after
editing this file; a broken workflow on `master` means no quality gate and no deploys.

## Testing

`lib/__tests__/indexnow.test.ts` — 21 tests covering `<loc>` extraction (whitespace,
entities, duplicates, malformed input), the diff (new URLs only, no removals, empty
before → everything), the non-canonical-host rejection, batching at the 10 000
boundary, payload shape, and the key/file coherence check. `submitPayload` is tested
with an injected fetch stub asserting the URL, method, content type and body.

No end-to-end test hits IndexNow. The bootstrap run is the real verification, and its
response code is visible in the CLI output.

**Windows note:** the Vitest `forks` pool fails to start workers in this worktree
(`Timeout waiting for worker to respond`) *and exits 0* while doing it — a false green.
Run local tests with `--pool=threads`. CI on Ubuntu is unaffected.

## Post-merge

Run `npx tsx scripts/indexnow.ts --all` once against production, then confirm in Bing
Webmaster Tools (URL submission → IndexNow) that the submissions register.
