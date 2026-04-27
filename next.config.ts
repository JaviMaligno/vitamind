import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isProductionDeploy = process.env.VERCEL_ENV === "production";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  async headers() {
    if (isProductionDeploy) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
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
