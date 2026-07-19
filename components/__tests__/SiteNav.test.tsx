import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// Translations resolve to their key path; the Link mock preserves hrefs
// verbatim and fires onClick so the drawer's close-on-navigate works.
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

import SiteNav from "@/components/SiteNav";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("SiteNav", () => {
  it("renders the desktop inline secondary nav and no drawer at rest", () => {
    render(<SiteNav />);
    // Desktop nav is CSS-hidden below lg but present in the DOM.
    const nav = screen.getByRole("navigation", { name: "nav.menu" });
    expect(within(nav).getByRole("link", { name: "footer.partners" }).getAttribute("href")).toBe("/partners");
    expect(within(nav).getByRole("link", { name: "nav.cities" }).getAttribute("href")).toBe("/vitamin-d");
    // Learn is a primary bottom tab now — no longer duplicated here.
    expect(within(nav).queryByRole("link", { name: "footer.learn" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a drawer with the secondary pages and city shortcuts", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "nav.menu" }));

    const dialog = screen.getByRole("dialog", { name: "nav.menu" });
    expect(within(dialog).getByRole("link", { name: "footer.partners" }).getAttribute("href")).toBe("/partners");
    expect(within(dialog).queryByRole("link", { name: "footer.learn" })).toBeNull();
    // Locale-local city shortcuts from CITY_SLUGS (SEO + human quick access).
    expect(within(dialog).getByRole("link", { name: "cities.madrid" }).getAttribute("href")).toBe("/vitamin-d/madrid");
    expect(within(dialog).getByRole("link", { name: "cities.nueva-york" }).getAttribute("href")).toBe("/vitamin-d/new-york");
    expect(within(dialog).getByRole("link", { name: /footer\.allCities/ }).getAttribute("href")).toBe("/vitamin-d");
  });

  it("closes the drawer via the close button", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "nav.menu" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "nav.close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the drawer when a nav link is followed", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "nav.menu" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("link", { name: "footer.partners" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
