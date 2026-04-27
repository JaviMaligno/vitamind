export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://getvitamind.app"
).replace(/\/$/, "");

export const IS_PRODUCTION_DEPLOY = process.env.VERCEL_ENV === "production";
