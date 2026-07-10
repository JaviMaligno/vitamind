import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const replace = vi.fn();

vi.mock("next-intl", () => ({ useLocale: () => "es" }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/vitamina-d/madrid",
}));

import LanguageSelector from "@/components/LanguageSelector";

/** Emits the hreflang links a page renders into <head>. */
function withAlternates(links: Record<string, string>) {
  for (const [locale, href] of Object.entries(links)) {
    const el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hrefLang", locale); // React serializes it camelCase
    el.setAttribute("href", href);
    document.head.appendChild(el);
  }
}

beforeEach(() => {
  replace.mockClear();
  document.head.innerHTML = "";
});
afterEach(() => {
  document.head.innerHTML = "";
});

describe("LanguageSelector", () => {
  // The bug: on /vitamina-d/madrid, clicking EN used to navigate to
  // /en/vitamina-d/madrid -- Spanish route prefix under an English locale -- and 404.
  it("follows the page's hreflang link instead of reusing the current path", () => {
    withAlternates({
      es: "https://getvitamind.app/vitamina-d/madrid",
      en: "https://getvitamind.app/en/vitamin-d/madrid",
      lt: "https://getvitamind.app/lt/vitaminas-d/madridas",
    });
    render(<LanguageSelector />);

    fireEvent.click(screen.getByText("EN"));
    expect(replace).toHaveBeenCalledWith("/vitamin-d/madrid", { locale: "en" });

    fireEvent.click(screen.getByText("LT"));
    expect(replace).toHaveBeenCalledWith("/vitaminas-d/madridas", { locale: "lt" });
  });

  it("never navigates to the canonical host from another deployment", () => {
    withAlternates({ en: "https://getvitamind.app/en/vitamin-d/madrid" });
    render(<LanguageSelector />);

    fireEvent.click(screen.getByText("EN"));
    const [target] = replace.mock.calls[0];
    expect(target).not.toContain("getvitamind.app");
    expect(target.startsWith("/")).toBe(true);
  });

  it("falls back to the current path when a page emits no alternates", () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByText("FR"));
    expect(replace).toHaveBeenCalledWith("/vitamina-d/madrid", { locale: "fr" });
  });
});
