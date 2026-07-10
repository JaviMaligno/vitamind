/** The one host whose pages may be indexed. */
const CANONICAL_HOST = "getvitamind.app";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? `https://${CANONICAL_HOST}`
).replace(/\/$/, "");

/**
 * Whether this deployment is the real, indexable site.
 *
 * `VERCEL_ENV === "production"` is NOT sufficient: the `vitamind-dev` project has
 * its own production environment, so deploying it to `vitamind-dev.vercel.app`
 * also sets `VERCEL_ENV=production`. That made the dev site serve
 * `robots.txt: Allow: /` while every canonical it emitted pointed at the real
 * host -- a duplicate-content hazard.
 *
 * So also require that the project's production domain IS the canonical host.
 * `VERCEL_PROJECT_PRODUCTION_URL` is a Vercel system variable holding that domain
 * (without a scheme).
 *
 * If that variable is ever absent we fall back to assuming the canonical host.
 * The two failure modes are not symmetric: wrongly de-indexing getvitamind.app
 * would be far worse than leaving the dev site indexable, which is merely the
 * status quo this fix addresses.
 */
export const IS_PRODUCTION_DEPLOY =
  process.env.VERCEL_ENV === "production" &&
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? CANONICAL_HOST) === CANONICAL_HOST;
