/**
 * Partner/affiliate configuration.
 *
 * When a partner is active, supplement recommendations across the app
 * will show their branding and link instead of the generic learn page link.
 *
 * To activate a partner, set `active` to an object with their details.
 * To deactivate, set `active` to null — the app falls back to generic links.
 */

export interface PartnerConfig {
  /** Partner display name (e.g. "Better You") */
  name: string;
  /** URL to link to (affiliate link, product page, etc.) */
  url: string;
  /** Short tagline shown next to the recommendation */
  tagline: Record<string, string>;
  /** UTM or tracking params appended to the URL */
  trackingParams?: string;
}

/**
 * Set this to a PartnerConfig to activate partner branding,
 * or null for generic supplement advice.
 */
export const activePartner: PartnerConfig | null = null;

// Example partner configuration:
// export const activePartner: PartnerConfig = {
//   name: "Better You",
//   url: "https://bfriendy.com/vitamind3",
//   tagline: {
//     es: "Vitamina D3 de alta absorción",
//     en: "High-absorption Vitamin D3",
//     fr: "Vitamine D3 à haute absorption",
//     de: "Vitamin D3 mit hoher Absorption",
//     ru: "Витамин D3 высокой усвояемости",
//     lt: "Didelės absorbcijos vitaminas D3",
//   },
//   trackingParams: "utm_source=vitamind&utm_medium=app&utm_campaign=supplement",
// };

export function getPartnerUrl(partner: PartnerConfig): string {
  if (partner.trackingParams) {
    const separator = partner.url.includes("?") ? "&" : "?";
    return `${partner.url}${separator}${partner.trackingParams}`;
  }
  return partner.url;
}
