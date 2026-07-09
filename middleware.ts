import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { legacyLocaleRedirect } from "./i18n/legacy-locale-redirect";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
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
  return intlMiddleware(request);
}

export const config = {
  // Skip API, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
