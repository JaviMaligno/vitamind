const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function setLocaleCookie(lang: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `locale=${lang};path=/;max-age=${ONE_YEAR_SECONDS}`;
}
