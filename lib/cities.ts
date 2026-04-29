import type { City } from "./types";

const BUILTIN_RAW: { n: string; lat: number; lon: number; tz: number; t: string; c: string }[] = [
  {n:"Reikiavik",lat:64.15,lon:-21.94,tz:0,t:"Atlantic/Reykjavik",c:"\u{1F1EE}\u{1F1F8}"},{n:"Helsinki",lat:60.17,lon:24.94,tz:2,t:"Europe/Helsinki",c:"\u{1F1EB}\u{1F1EE}"},
  {n:"Oslo",lat:59.91,lon:10.75,tz:1,t:"Europe/Oslo",c:"\u{1F1F3}\u{1F1F4}"},{n:"Estocolmo",lat:59.33,lon:18.07,tz:1,t:"Europe/Stockholm",c:"\u{1F1F8}\u{1F1EA}"},
  {n:"Moscu",lat:55.76,lon:37.62,tz:3,t:"Europe/Moscow",c:"\u{1F1F7}\u{1F1FA}"},{n:"Edimburgo",lat:55.95,lon:-3.19,tz:0,t:"Europe/London",c:"\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"},
  {n:"Copenhague",lat:55.68,lon:12.57,tz:1,t:"Europe/Copenhagen",c:"\u{1F1E9}\u{1F1F0}"},{n:"Dublin",lat:53.35,lon:-6.26,tz:0,t:"Europe/Dublin",c:"\u{1F1EE}\u{1F1EA}"},
  {n:"Berlin",lat:52.52,lon:13.41,tz:1,t:"Europe/Berlin",c:"\u{1F1E9}\u{1F1EA}"},{n:"Amsterdam",lat:52.37,lon:4.90,tz:1,t:"Europe/Amsterdam",c:"\u{1F1F3}\u{1F1F1}"},
  {n:"Londres",lat:51.51,lon:-0.13,tz:0,t:"Europe/London",c:"\u{1F1EC}\u{1F1E7}"},{n:"Bruselas",lat:50.85,lon:4.35,tz:1,t:"Europe/Brussels",c:"\u{1F1E7}\u{1F1EA}"},
  {n:"Paris",lat:48.86,lon:2.35,tz:1,t:"Europe/Paris",c:"\u{1F1EB}\u{1F1F7}"},{n:"Viena",lat:48.21,lon:16.37,tz:1,t:"Europe/Vienna",c:"\u{1F1E6}\u{1F1F9}"},
  {n:"Zurich",lat:47.37,lon:8.54,tz:1,t:"Europe/Zurich",c:"\u{1F1E8}\u{1F1ED}"},{n:"Budapest",lat:47.50,lon:19.04,tz:1,t:"Europe/Budapest",c:"\u{1F1ED}\u{1F1FA}"},
  {n:"Vancouver",lat:49.28,lon:-123.12,tz:-8,t:"America/Vancouver",c:"\u{1F1E8}\u{1F1E6}"},{n:"Seattle",lat:47.61,lon:-122.33,tz:-8,t:"America/Los_Angeles",c:"\u{1F1FA}\u{1F1F8}"},
  {n:"Toronto",lat:43.65,lon:-79.38,tz:-5,t:"America/Toronto",c:"\u{1F1E8}\u{1F1E6}"},{n:"Barcelona",lat:41.39,lon:2.17,tz:1,t:"Europe/Madrid",c:"\u{1F1EA}\u{1F1F8}"},
  {n:"Roma",lat:41.90,lon:12.50,tz:1,t:"Europe/Rome",c:"\u{1F1EE}\u{1F1F9}"},{n:"Estambul",lat:41.01,lon:28.98,tz:3,t:"Europe/Istanbul",c:"\u{1F1F9}\u{1F1F7}"},
  {n:"Chicago",lat:41.88,lon:-87.63,tz:-6,t:"America/Chicago",c:"\u{1F1FA}\u{1F1F8}"},{n:"Nueva York",lat:40.71,lon:-74.01,tz:-5,t:"America/New_York",c:"\u{1F1FA}\u{1F1F8}"},
  {n:"Madrid",lat:40.42,lon:-3.70,tz:1,t:"Europe/Madrid",c:"\u{1F1EA}\u{1F1F8}"},{n:"Pekin",lat:39.90,lon:116.40,tz:8,t:"Asia/Shanghai",c:"\u{1F1E8}\u{1F1F3}"},
  {n:"Atenas",lat:37.98,lon:23.73,tz:2,t:"Europe/Athens",c:"\u{1F1EC}\u{1F1F7}"},{n:"Lisboa",lat:38.72,lon:-9.14,tz:0,t:"Europe/Lisbon",c:"\u{1F1F5}\u{1F1F9}"},
  {n:"San Francisco",lat:37.77,lon:-122.42,tz:-8,t:"America/Los_Angeles",c:"\u{1F1FA}\u{1F1F8}"},{n:"Seul",lat:37.57,lon:126.98,tz:9,t:"Asia/Seoul",c:"\u{1F1F0}\u{1F1F7}"},
  {n:"Tokio",lat:35.68,lon:139.69,tz:9,t:"Asia/Tokyo",c:"\u{1F1EF}\u{1F1F5}"},{n:"Los Angeles",lat:34.05,lon:-118.24,tz:-8,t:"America/Los_Angeles",c:"\u{1F1FA}\u{1F1F8}"},
  {n:"Shanghai",lat:31.23,lon:121.47,tz:8,t:"Asia/Shanghai",c:"\u{1F1E8}\u{1F1F3}"},{n:"El Cairo",lat:30.04,lon:31.24,tz:2,t:"Africa/Cairo",c:"\u{1F1EA}\u{1F1EC}"},
  {n:"Delhi",lat:28.61,lon:77.21,tz:5.5,t:"Asia/Kolkata",c:"\u{1F1EE}\u{1F1F3}"},{n:"Dubai",lat:25.20,lon:55.27,tz:4,t:"Asia/Dubai",c:"\u{1F1E6}\u{1F1EA}"},
  {n:"Miami",lat:25.76,lon:-80.19,tz:-5,t:"America/New_York",c:"\u{1F1FA}\u{1F1F8}"},{n:"Hong Kong",lat:22.32,lon:114.17,tz:8,t:"Asia/Hong_Kong",c:"\u{1F1ED}\u{1F1F0}"},
  {n:"Ciudad de Mexico",lat:19.43,lon:-99.13,tz:-6,t:"America/Mexico_City",c:"\u{1F1F2}\u{1F1FD}"},{n:"Bangkok",lat:13.76,lon:100.50,tz:7,t:"Asia/Bangkok",c:"\u{1F1F9}\u{1F1ED}"},
  {n:"Bogota",lat:4.71,lon:-74.07,tz:-5,t:"America/Bogota",c:"\u{1F1E8}\u{1F1F4}"},{n:"Singapur",lat:1.35,lon:103.82,tz:8,t:"Asia/Singapore",c:"\u{1F1F8}\u{1F1EC}"},
  {n:"Nairobi",lat:-1.29,lon:36.82,tz:3,t:"Africa/Nairobi",c:"\u{1F1F0}\u{1F1EA}"},{n:"Lima",lat:-12.05,lon:-77.04,tz:-5,t:"America/Lima",c:"\u{1F1F5}\u{1F1EA}"},
  {n:"Sao Paulo",lat:-23.55,lon:-46.63,tz:-3,t:"America/Sao_Paulo",c:"\u{1F1E7}\u{1F1F7}"},{n:"Buenos Aires",lat:-34.60,lon:-58.38,tz:-3,t:"America/Argentina/Buenos_Aires",c:"\u{1F1E6}\u{1F1F7}"},
  {n:"Santiago",lat:-33.45,lon:-70.67,tz:-4,t:"America/Santiago",c:"\u{1F1E8}\u{1F1F1}"},{n:"Ciudad del Cabo",lat:-33.92,lon:18.42,tz:2,t:"Africa/Johannesburg",c:"\u{1F1FF}\u{1F1E6}"},
  {n:"Sidney",lat:-33.87,lon:151.21,tz:11,t:"Australia/Sydney",c:"\u{1F1E6}\u{1F1FA}"},{n:"Melbourne",lat:-37.81,lon:144.96,tz:11,t:"Australia/Melbourne",c:"\u{1F1E6}\u{1F1FA}"},
  {n:"Auckland",lat:-36.85,lon:174.76,tz:13,t:"Pacific/Auckland",c:"\u{1F1F3}\u{1F1FF}"},{n:"Honolulu",lat:21.31,lon:-157.86,tz:-10,t:"Pacific/Honolulu",c:"\u{1F1FA}\u{1F1F8}"},
  {n:"Anchorage",lat:61.22,lon:-149.90,tz:-9,t:"America/Anchorage",c:"\u{1F1FA}\u{1F1F8}"},{n:"Tromso",lat:69.65,lon:18.96,tz:1,t:"Europe/Oslo",c:"\u{1F1F3}\u{1F1F4}"},
  {n:"Sevilla",lat:37.39,lon:-5.98,tz:1,t:"Europe/Madrid",c:"\u{1F1EA}\u{1F1F8}"},{n:"Valencia",lat:39.47,lon:-0.38,tz:1,t:"Europe/Madrid",c:"\u{1F1EA}\u{1F1F8}"},
  {n:"Malaga",lat:36.72,lon:-4.42,tz:1,t:"Europe/Madrid",c:"\u{1F1EA}\u{1F1F8}"},{n:"Las Palmas",lat:28.10,lon:-15.41,tz:0,t:"Atlantic/Canary",c:"\u{1F1EA}\u{1F1F8}"},
  {n:"Tenerife",lat:28.47,lon:-16.25,tz:0,t:"Atlantic/Canary",c:"\u{1F1EA}\u{1F1F8}"},{n:"Marsella",lat:43.30,lon:5.37,tz:1,t:"Europe/Paris",c:"\u{1F1EB}\u{1F1F7}"},
  {n:"Taipei",lat:25.03,lon:121.57,tz:8,t:"Asia/Taipei",c:"\u{1F1F9}\u{1F1FC}"},{n:"Medellin",lat:6.25,lon:-75.56,tz:-5,t:"America/Bogota",c:"\u{1F1E8}\u{1F1F4}"},
  {n:"Denver",lat:39.74,lon:-104.99,tz:-7,t:"America/Denver",c:"\u{1F1FA}\u{1F1F8}"},{n:"Phoenix",lat:33.45,lon:-112.07,tz:-7,t:"America/Phoenix",c:"\u{1F1FA}\u{1F1F8}"},
  {n:"Varsovia",lat:52.23,lon:21.01,tz:1,t:"Europe/Warsaw",c:"\u{1F1F5}\u{1F1F1}"},{n:"Johannesburgo",lat:-26.20,lon:28.05,tz:2,t:"Africa/Johannesburg",c:"\u{1F1FF}\u{1F1E6}"},
  {n:"Perth",lat:-31.95,lon:115.86,tz:8,t:"Australia/Perth",c:"\u{1F1E6}\u{1F1FA}"},{n:"Lagos",lat:6.52,lon:3.38,tz:1,t:"Africa/Lagos",c:"\u{1F1F3}\u{1F1EC}"},
  {n:"Casablanca",lat:33.57,lon:-7.59,tz:1,t:"Africa/Casablanca",c:"\u{1F1F2}\u{1F1E6}"},{n:"Kuala Lumpur",lat:3.14,lon:101.69,tz:8,t:"Asia/Kuala_Lumpur",c:"\u{1F1F2}\u{1F1FE}"},
  {n:"Montevideo",lat:-34.88,lon:-56.16,tz:-3,t:"America/Montevideo",c:"\u{1F1FA}\u{1F1FE}"},{n:"Bombay",lat:19.08,lon:72.88,tz:5.5,t:"Asia/Kolkata",c:"\u{1F1EE}\u{1F1F3}"},
  {n:"Praga",lat:50.08,lon:14.44,tz:1,t:"Europe/Prague",c:"\u{1F1E8}\u{1F1FF}"},
];

export const BUILTIN_CITIES: City[] = BUILTIN_RAW
  .map((c) => ({
    id: `builtin:${c.n.toLowerCase().replace(/\s+/g, "-")}`,
    name: c.n,
    lat: c.lat,
    lon: c.lon,
    tz: c.tz,
    timezone: c.t,
    flag: c.c,
    source: "builtin" as const,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_FAVORITE_IDS: string[] = [];

export function cityToId(name: string): string {
  return `builtin:${name.toLowerCase().replace(/\s+/g, "-")}`;
}

export function findNearestCity(lat: number, cities: City[]): City | null {
  let best: City | null = null;
  let minD = 999;
  for (const c of cities) {
    const d = Math.abs(c.lat - lat);
    if (d < minD) { minD = d; best = c; }
  }
  return best && minD < 3 ? best : null;
}
