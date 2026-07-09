// `й` → "y" per BGN/PCGN, so "Нью-Йорк" → "nyu-york" (not "nyu-iork").
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * Turns a city name (in any of the 6 supported locales) into a stable ASCII URL
 * slug: lowercase → Cyrillic transliteration → strip Latin diacritics → collapse
 * non-alphanumerics into single hyphens. Deterministic: same name always yields
 * the same slug, so URLs stay stable across builds.
 */
export function slugify(name: string): string {
  const lower = name.toLowerCase();
  const translit = Array.from(lower)
    .map((ch) => (ch in CYRILLIC ? CYRILLIC[ch] : ch))
    .join("");
  const noDiacritics = translit.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return noDiacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
