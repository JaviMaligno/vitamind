/**
 * Picks the best supported locale from an HTTP `Accept-Language` header.
 *
 * Matches on the primary subtag (so `en-US` → `en`), honours quality values
 * (`;q=`), and returns `fallback` when the header is absent or lists nothing
 * we support. Used by `i18n/request.ts` to default new visitors to their
 * browser language instead of always Spanish.
 */
export function pickLocale(
  acceptLanguage: string | null | undefined,
  supported: readonly string[],
  fallback: string,
): string {
  if (!acceptLanguage) return fallback;

  const ranges = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((r) => r.tag && r.tag !== "*" && r.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranges) {
    const primary = tag.split("-")[0];
    const match = supported.find((s) => s.toLowerCase() === primary);
    if (match) return match;
  }
  return fallback;
}
