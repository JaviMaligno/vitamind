/**
 * Derive a flag-icons country code from a flag emoji. Windows ships no flag
 * emoji glyphs, so "🇬🇧" renders as the letters "GB"; converting to an ISO code
 * lets us render a real SVG flag instead (see components/ui/Flag.tsx).
 *
 * Handles the two shapes present in the data:
 *  - regional-indicator pairs (🇬🇧 → "gb")
 *  - subdivision tag sequences (🏴 + tag letters, e.g. Scotland → "gb-sct")
 */
export function flagCode(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const cps = [...emoji].map((c) => c.codePointAt(0) as number);

  // Subdivision tag flag: 🏴 (U+1F3F4) followed by tag letters (U+E0061–E007A).
  if (cps[0] === 0x1f3f4) {
    const letters = cps
      .slice(1)
      .filter((cp) => cp >= 0xe0061 && cp <= 0xe007a)
      .map((cp) => String.fromCharCode(cp - 0xe0000));
    // e.g. ["g","b","s","c","t"] → "gb-sct" (flag-icons subdivision code)
    if (letters.length >= 3) return letters[0] + letters[1] + "-" + letters.slice(2).join("");
    return null;
  }

  // Regional-indicator pair (each U+1F1E6–U+1F1FF maps to A–Z).
  if (
    cps.length >= 2 &&
    cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff &&
    cps[1] >= 0x1f1e6 && cps[1] <= 0x1f1ff
  ) {
    return (
      String.fromCharCode(cps[0] - 0x1f1e6 + 97) +
      String.fromCharCode(cps[1] - 0x1f1e6 + 97)
    );
  }

  return null;
}
