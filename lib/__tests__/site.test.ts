import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * `lib/site.ts` reads process.env at module load, so each case needs a fresh
 * import with the environment already in place.
 */
async function loadSite(env: Record<string, string | undefined>) {
  vi.resetModules();
  const saved = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const mod = await import("@/lib/site");
  process.env = saved;
  return mod;
}

afterEach(() => {
  vi.resetModules();
});

describe("IS_PRODUCTION_DEPLOY", () => {
  it("is true only on the canonical host's production deploy", async () => {
    const { IS_PRODUCTION_DEPLOY } = await loadSite({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "getvitamind.app",
    });
    expect(IS_PRODUCTION_DEPLOY).toBe(true);
  });

  // The bug this guards: deploying the `vitamind-dev` project to its own
  // production alias also sets VERCEL_ENV=production, which made the dev site
  // serve `robots.txt: Allow: /` while emitting canonicals for the real host.
  it("is false on the dev project's own production deploy", async () => {
    const { IS_PRODUCTION_DEPLOY } = await loadSite({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "vitamind-dev.vercel.app",
    });
    expect(IS_PRODUCTION_DEPLOY).toBe(false);
  });

  it("is false for preview and local builds", async () => {
    for (const env of [
      { VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "getvitamind.app" },
      { VERCEL_ENV: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined },
    ]) {
      const { IS_PRODUCTION_DEPLOY } = await loadSite(env);
      expect(IS_PRODUCTION_DEPLOY).toBe(false);
    }
  });

  // Asymmetric failure modes: wrongly de-indexing the real site is far worse
  // than leaving the dev site indexable, so a missing system variable defaults
  // to "this is the canonical host".
  it("assumes the canonical host when Vercel omits the production URL", async () => {
    const { IS_PRODUCTION_DEPLOY } = await loadSite({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(IS_PRODUCTION_DEPLOY).toBe(true);
  });
});

describe("SITE_URL", () => {
  it("defaults to the canonical host and strips a trailing slash", async () => {
    expect((await loadSite({ NEXT_PUBLIC_SITE_URL: undefined })).SITE_URL).toBe(
      "https://getvitamind.app",
    );
    expect((await loadSite({ NEXT_PUBLIC_SITE_URL: "https://example.com/" })).SITE_URL).toBe(
      "https://example.com",
    );
  });
});
