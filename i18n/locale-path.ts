/**
 * Turns an hreflang `href` into the locale-local pathname next-intl's router
 * expects (i.e. with the locale segment removed, since the router re-adds it).
 *
 * Why go through hreflang at all? Because a URL is not always the same path in
 * another language. `/vitamina-d/madrid` becomes `/en/vitamin-d/madrid` and
 * `/lt/vitaminas-d/madridas` -- both the route prefix and the city slug are
 * localized. Simply swapping the locale segment yields `/en/vitamina-d/madrid`,
 * which 404s. Every page already emits the correct URL for each locale as an
 * hreflang link, so that is the single source of truth.
 *
 * The href is absolute and points at the canonical host, which is not the host
 * we are running on for dev and preview deploys. Only the path is used.
 */
export function localePathFromHref(
  href: string,
  locales: readonly string[],
): string {
  // A relative href has no host; give URL a base it can discard.
  const url = new URL(href, "https://placeholder.invalid");
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length > 0 && locales.includes(segments[0])) {
    segments.shift();
  }

  const path = `/${segments.join("/")}`;
  return `${path}${url.search}${url.hash}`;
}

/**
 * The path to navigate to when switching to `locale`, read from the page's own
 * hreflang links. Returns null when the page emits none, so the caller can fall
 * back to reusing the current pathname (correct for routes whose path does not
 * change across locales).
 *
 * Note the attribute is serialized as `hrefLang` by React; HTML attribute
 * selectors are case-insensitive, so `[hreflang=...]` matches it.
 */
export function alternatePathForLocale(
  doc: Pick<Document, "querySelector">,
  locale: string,
  locales: readonly string[],
): string | null {
  const link = doc.querySelector(
    `link[rel="alternate"][hreflang="${locale}"]`,
  ) as HTMLLinkElement | null;

  const href = link?.getAttribute("href");
  if (!href) return null;

  return localePathFromHref(href, locales);
}
