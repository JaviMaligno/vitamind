import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Build version baked into the client bundle for the SW-update handshake in
// components/UpdateNotice.tsx. Must resolve to the same value that
// scripts/build-sw.mjs stamps into public/sw.js (keep both in sync). A drift
// degrades gracefully: on mismatch the client just shows the update notice.
function resolveBuildVersion(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  }
  try {
    return execSync("git rev-parse --short=8 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const isProductionDeploy = process.env.VERCEL_ENV === "production";
const isDev = process.env.NODE_ENV === "development";

// Every external origin the browser legitimately talks to. If a fetch/script/
// style starts failing with a CSP violation in the console, the fix is to add
// its origin here — never to remove the header.
const csp = [
  "default-src 'self'",
  // Next.js requires inline bootstrap scripts; dev additionally needs eval for
  // react-refresh. va.vercel-scripts.com serves @vercel/analytics in dev mode
  // (prod loads it same-origin from /_vercel/insights).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // supabase-js (auth/profiles), jsdelivr (world-atlas TopoJSON in WorldMap),
  // nominatim (city geocoding fallback in CitySearch)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://nominatim.openstreetmap.org https://va.vercel-scripts.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only geolocation: adding empty-allowlist directives (camera=(), microphone=(),
  // payment=()) makes Vercel's proxy fail at runtime with 500
  // MIDDLEWARE_INVOCATION_FAILED ("failed to load env vars: EnvFileReadError") on
  // every request. Verified by bisecting deploys on 2026-07-17; re-test on a
  // throwaway deployment before extending this value.
  { key: "Permissions-Policy", value: "geolocation=(self)" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  env: {
    NEXT_PUBLIC_BUILD_VERSION: resolveBuildVersion(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isProductionDeploy
          ? securityHeaders
          : [...securityHeaders, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.getvitamind.app" }],
        destination: "https://getvitamind.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "vitamind-six.vercel.app" }],
        destination: "https://getvitamind.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
