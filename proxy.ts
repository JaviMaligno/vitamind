import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { legacyLocaleRedirect } from "./i18n/legacy-locale-redirect";
import { crossLocaleRedirect } from "./i18n/cross-locale-redirect";
import { onDemandCityRewrite } from "./i18n/on-demand-city-rewrite";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // 301 legacy ?locale=xx URLs to the prefixed path, then hand off to next-intl.
  const legacyTarget = legacyLocaleRedirect(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  );
  if (legacyTarget) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    url.search = "";
    return NextResponse.redirect(url, 301);
  }

  // 301 city URLs whose locale segment disagrees with their prefix and slug — the
  // residue of a language-switcher bug fixed on 2026-07-10. Returns null for every
  // valid path, so the normal i18n handling below is untouched.
  const crossLocaleTarget = crossLocaleRedirect(request.nextUrl.pathname);
  if (crossLocaleTarget) {
    const url = request.nextUrl.clone();
    url.pathname = crossLocaleTarget;
    return NextResponse.redirect(url, 301);
  }

  // Serve an on-demand city page from its own route file, at the same public URL.
  //
  // AFTER the two 301 helpers, deliberately. A cross-locale leftover such as
  // `/de/vitaminas-d/fyniksas` is not an on-demand slug, so the order does not
  // change any verdict today — but reversing it would be one regex away from
  // serving those 118 URLs in place and silently retiring redirects that Search
  // Console still crawls.
  //
  // Why a rewrite at all, rather than a branch inside the shared route file:
  // segment config is per FILE and only `force-dynamic` stops Next from writing
  // a `notFound()` into the full route cache (measured, see the helper's header),
  // and `force-dynamic` in the shared file would take all 438 prerendered curated
  // pages out of the build. Returning the rewrite directly skips next-intl for
  // these paths; the on-demand route reads its locale from the segment the target
  // spells out, which is why the target always carries one.
  const onDemandTarget = onDemandCityRewrite(request.nextUrl.pathname);
  if (onDemandTarget) {
    const url = request.nextUrl.clone();
    url.pathname = onDemandTarget;
    return NextResponse.rewrite(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
