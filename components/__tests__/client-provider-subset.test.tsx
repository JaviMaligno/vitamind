import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { pickClientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

/**
 * Renders the two ROOT-SCOPED callers through the real provider, with the real
 * message subset the layout ships, in all six locales.
 *
 * Why this file exists alongside the static walk in
 * `i18n/__tests__/client-messages.test.ts`: the other component tests here
 * (SiteFooter, SiteNav, BottomTabBar, TodayWindow, NotificationToggle,
 * UpdateNotice, LanguageSelector) all `vi.mock("next-intl")` with a translator
 * that returns its own key path. That mock is right for what those tests assert
 * — hrefs, landmarks, drawer behaviour, all of which should not depend on copy —
 * but it means they never touch a message file, so they would pass unchanged if
 * the provider stopped carrying `footer` or `app` entirely. They are not
 * evidence about this filter, and converting them to real messages would only
 * make their assertions restate the Spanish copy.
 *
 * SiteFooter and SiteNav are the components to render for real because they are
 * where the danger concentrates: both call `useTranslations()` with NO namespace
 * and reach four namespaces (`app`, `footer`, `nav`, `cities`) through dotted
 * keys. Two of those, `app` and `footer`, are named as a namespace absolutely
 * nowhere in the codebase, which is exactly how a namespace audit concluded they
 * were server-only.
 *
 * `onError` is what makes the render an assertion. next-intl's default is a
 * `console.error` plus a `getMessageFallback` that joins namespace and key, so a
 * miss renders the string "footer.about" as if it were a label and every
 * `getByRole` here would still find something. Throwing turns the miss into a
 * failed test instead of into indexed HTML.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const { default: SiteFooter } = await import("@/components/SiteFooter");
const { default: SiteNav } = await import("@/components/SiteNav");

const FULL: Record<string, Record<string, unknown>> = { es, en, fr, de, ru, lt };

const throwOnMissing = (error: unknown) => {
  throw error;
};

/** Read a dotted path out of a raw message file, for asserting on real copy. */
function message(locale: string, path: string): string {
  let node: unknown = FULL[locale];
  for (const segment of path.split(".")) {
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== "string") throw new Error(`messages/${locale}.json has no ${path}`);
  return node;
}

describe("client provider subset renders the root-scoped callers", () => {
  it("covers every locale the app routes", () => {
    // If a locale is added to routing without a message file, FULL is silently
    // short and the loop below quietly stops covering it.
    expect(Object.keys(FULL).sort()).toEqual([...routing.locales].sort());
  });

  for (const locale of routing.locales) {
    it(`renders SiteFooter in ${locale} with no missing message`, () => {
      const messages = pickClientMessages(FULL[locale]);
      const { container } = render(
        <NextIntlClientProvider locale={locale} messages={messages} onError={throwOnMissing}>
          <SiteFooter />
        </NextIntlClientProvider>,
      );

      // Real copy, not a key path. `app.title` and `footer.allCities` are read
      // through the root-scoped translator, so a dropped namespace surfaces here
      // even if `onError` were ever loosened.
      const text = container.textContent ?? "";
      expect(text).toContain(message(locale, "app.title"));
      expect(text).toContain(message(locale, "footer.allCities"));
      expect(text).not.toMatch(/\bfooter\.[a-zA-Z]/);
      expect(text).not.toMatch(/\bapp\.[a-zA-Z]/);
      expect(text).not.toMatch(/\bnav\.[a-zA-Z]/);
      expect(text).not.toMatch(/\bcities\.[a-z-]/);
    });

    it(`renders SiteNav in ${locale} with no missing message`, () => {
      const messages = pickClientMessages(FULL[locale]);
      const { container } = render(
        <NextIntlClientProvider locale={locale} messages={messages} onError={throwOnMissing}>
          <SiteNav />
        </NextIntlClientProvider>,
      );
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/\bfooter\.[a-zA-Z]/);
      expect(text).not.toMatch(/\bnav\.[a-zA-Z]/);
      // The nav's aria-labels come from `nav.*` too, and a miss there would not
      // land in textContent — check the accessible name is real copy.
      const menus = screen.getAllByRole("navigation");
      for (const menu of menus) {
        const label = menu.getAttribute("aria-label");
        if (label) expect(label).not.toMatch(/^nav\./);
      }
    });
  }
});
