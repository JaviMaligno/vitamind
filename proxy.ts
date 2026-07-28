import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { legacyLocaleRedirect } from "./i18n/legacy-locale-redirect";
import { crossLocaleRedirect } from "./i18n/cross-locale-redirect";

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

  return intlMiddleware(request);
}

export const config = {
  // Skip API, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
