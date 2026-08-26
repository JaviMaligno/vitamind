import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveSunPage } from "@/lib/sun-routes";
import { localizedCityName } from "@/lib/city-routes";
import { monthName } from "@/lib/city-copy";
import { monthData } from "@/lib/sun-copy";
import { fmtTime } from "@/lib/solar";

/**
 * The share card, and the Event's `image`.
 *
 * Google lists `image` among the fields it wants on an Event, and it was the one
 * left empty on purpose: filling it meant carrying a picture the page does not
 * show, which its own structured-data policy warns against. A card generated
 * from this city and this month is not that — it renders the page's own figures,
 * so the markup points at something the page really contains.
 *
 * It earns its keep twice: these pages had no share card at all, so every link
 * posted to WhatsApp or Telegram was a bare URL.
 *
 * Kept to numerals and the two names the page prints. Satori ships one default
 * font and this site serves Russian and Lithuanian; every glyph beyond that is a
 * blank box, so the layout leans on figures, which are safe in every locale.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sunrise and sunset times";

type Params = { locale: string; cityPrefix: string; city: string; month: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const p = await params;
  const resolved = resolveSunPage(p.locale, p.cityPrefix, p.city, p.month);
  // 404, never a blank card: an unresolved slug returning an empty ImageResponse
  // is a silently broken share image, and nothing would ever surface it.
  if (!resolved) notFound();

  const { city, base, monthIndex } = resolved;
  const t = await getTranslations({ locale: p.locale, namespace: "sunTimes" });
  const cityName = localizedCityName(p.locale, base);
  const month = monthName(p.locale, monthIndex);
  const { mid } = monthData(city.lat, city.lon, city.tz, city.timezone, city.elevation ?? 0, monthIndex);

  const stat = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 26, color: "#8b93a5", textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
      <div style={{ fontSize: 76, color: "#f5c451", fontWeight: 700 }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: "#12141a", padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 30, color: "#8b93a5", letterSpacing: 3 }}>getvitamind.app</div>
          <div style={{ fontSize: 92, color: "#e8eaf0", fontWeight: 700 }}>{cityName}</div>
          <div style={{ fontSize: 46, color: "#9aa1b0" }}>{month}</div>
        </div>
        <div style={{ display: "flex", gap: 96 }}>
          {stat(t("sunrise"), mid.sunrise !== null ? fmtTime(mid.sunrise) : "—")}
          {stat(t("sunset"), mid.sunset !== null ? fmtTime(mid.sunset) : "—")}
        </div>
      </div>
    ),
    size,
  );
}
