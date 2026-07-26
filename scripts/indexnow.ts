/**
 * Submit URLs to IndexNow (Bing, Yandex, Seznam, Naver).
 *
 *   npx tsx scripts/indexnow.ts --all                 # every sitemap URL (bootstrap, run once)
 *   npx tsx scripts/indexnow.ts --before before.xml   # only URLs the old sitemap lacked (CI)
 *   npx tsx scripts/indexnow.ts --all --dry-run       # print the submission, send nothing
 *
 * The current URL list comes from this commit's own `app/sitemap.ts`, not from
 * the network: the deployed sitemap sits behind the Vercel edge cache (which
 * ignores query strings, so a cache-buster does not help) and reading it back
 * right after a deploy is a race against cache purging. Generating it locally is
 * exact and needs no waiting.
 *
 * The `--before` snapshot, by contrast, is genuinely remote — it is the sitemap
 * as production served it before this deploy, captured by CI ahead of the deploy
 * step. The edge cache is purged per deploy, so that read reflects the previous
 * deploy, which is precisely the baseline wanted.
 */

import { readFileSync } from "node:fs";
import sitemap from "@/app/sitemap";
import {
  INDEXNOW_KEY,
  buildPayloads,
  keyLocation,
  newUrlsSince,
  submitPayload,
} from "@/lib/indexnow";

type Options = {
  all: boolean;
  beforeFile: string | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { all: false, beforeFile: null, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--before") {
      options.beforeFile = argv[++i] ?? null;
      if (!options.beforeFile) throw new Error("--before needs a file path");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.all === Boolean(options.beforeFile)) {
    throw new Error("Pass exactly one of --all or --before <file>");
  }

  return options;
}

/** An unreadable snapshot is treated as empty, i.e. everything counts as new. */
function readSnapshot(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    console.warn(
      `[indexnow] could not read ${file} (${(error as Error).message}) — treating every URL as new`,
    );
    return "";
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const currentUrls = sitemap().map((entry) => entry.url);

  const urls = options.all
    ? currentUrls
    : newUrlsSince(readSnapshot(options.beforeFile!), currentUrls);

  console.log(
    `[indexnow] sitemap has ${currentUrls.length} URLs; ${urls.length} to submit` +
      (options.all ? " (--all)" : ` (new since ${options.beforeFile})`),
  );

  if (urls.length === 0) {
    console.log("[indexnow] nothing new to submit");
    return;
  }

  const payloads = buildPayloads(urls);
  console.log(`[indexnow] key ${INDEXNOW_KEY} at ${keyLocation()}`);

  if (options.dryRun) {
    for (const [i, payload] of payloads.entries()) {
      console.log(`[indexnow] dry-run batch ${i + 1}/${payloads.length}: ${payload.urlList.length} URLs`);
      for (const url of payload.urlList.slice(0, 10)) console.log(`  ${url}`);
      if (payload.urlList.length > 10) {
        console.log(`  … and ${payload.urlList.length - 10} more`);
      }
    }
    return;
  }

  let failed = 0;
  for (const [i, payload] of payloads.entries()) {
    const label = `batch ${i + 1}/${payloads.length} (${payload.urlList.length} URLs)`;
    const result = await submitPayload(payload);

    if (result.ok) {
      console.log(`[indexnow] ${label}: ${result.status} OK`);
    } else {
      failed++;
      // 403 almost always means the key file is unreachable or its contents do
      // not match the key. 422 means a URL was rejected for the declared host.
      console.error(`[indexnow] ${label}: ${result.status} ${result.body.slice(0, 300)}`);
    }
  }

  if (failed > 0) {
    throw new Error(`[indexnow] ${failed}/${payloads.length} batches were rejected`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
