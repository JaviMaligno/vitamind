import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Translations resolve to their key path so assertions don't depend on message
// files; the Link mock must preserve hrefs verbatim — the footer's SEO value
// lives in them.
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => {
    const t = (key: string) => (ns ? `${ns}.${key}` : key);
    t.has = () => true;
    return t;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import SiteFooter from "@/components/SiteFooter";

describe("SiteFooter", () => {
  // The footer exists to give the city pages sitewide SSR internal links: it
  // must render synchronously (no mounted gate) with the locale-local slugs
  // from the generated CITY_SLUGS map.
  it("renders locale-local city links and the index link", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "cities.madrid" }).getAttribute("href")).toBe("/vitamin-d/madrid");
    expect(screen.getByRole("link", { name: "cities.nueva-york" }).getAttribute("href")).toBe("/vitamin-d/new-york");
    expect(screen.getByRole("link", { name: /footer\.allCities/ }).getAttribute("href")).toBe("/vitamin-d");
  });

  it("renders all 10 popular cities", () => {
    render(<SiteFooter />);
    expect(screen.getAllByRole("link", { name: /^cities\./ })).toHaveLength(10);
  });

  it("exposes two labelled navs inside a contentinfo landmark", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "footer.appHeading" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "footer.citiesHeading" })).toBeTruthy();
  });

  it("links every page missing from the bottom tab bar", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "footer.learn" }).getAttribute("href")).toBe("/learn");
    expect(screen.getByRole("link", { name: "footer.partners" }).getAttribute("href")).toBe("/partners");
  });

  // The AppShell builtBy div and the explore-page attribution were absorbed
  // here: same external target and security rel, app.footer copy present once.
  it("keeps the builtBy attribution as a safe external link", () => {
    render(<SiteFooter />);
    const a = screen.getByRole("link", { name: "app.builtBy" });
    expect(a.getAttribute("href")).toBe("https://javieraguilar.ai");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener");
    expect(screen.getByText("app.footer")).toBeTruthy();
  });
});
