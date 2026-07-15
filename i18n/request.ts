import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// The locale comes from the URL segment. Accept-Language detection for a
// prefix-less request is done by next-intl's createMiddleware(routing)
// (localeDetection) in proxy.ts — not the legacy ?locale= redirect — so this
// config only validates the requested locale and loads its messages.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
