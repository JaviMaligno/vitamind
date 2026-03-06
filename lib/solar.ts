import type { SolarPoint, VitDWindow } from "./types";

const RAD = Math.PI / 180;

export function declination(doy: number): number {
  return 23.44 * Math.sin(((360 / 365) * (doy - 81)) * RAD);
}

export function vitDHrs(lat: number, doy: number, thr: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const tr = thr * RAD;
  const cd = Math.cos(lr) * Math.cos(d);
  if (Math.abs(cd) < 1e-10) return 0;
  const cosH = (Math.sin(tr) - Math.sin(lr) * Math.sin(d)) / cd;
  if (cosH >= 1) return 0;
  if (cosH <= -1) return 24;
  return (2 * Math.acos(cosH) * 12) / Math.PI;
}

export function solarElev(lat: number, lon: number, doy: number, utcH: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const B = ((360 / 365) * (doy - 81)) * RAD;
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const ha = ((utcH - (12 - lon / 15 - EoT / 60)) * 15) * RAD;
  const sinElev = Math.sin(lr) * Math.sin(d) + Math.cos(lr) * Math.cos(d) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}

export function getCurve(lat: number, lon: number, doy: number, tz: number): SolarPoint[] {
  const p: SolarPoint[] = [];
  for (let m = 0; m <= 1440; m += 5) {
    const localH = m / 60;
    const utcH = localH - tz;
    p.push({ localHours: localH, elevation: solarElev(lat, lon, doy, utcH) });
  }
  return p;
}

export function getWindow(curve: SolarPoint[], threshold: number): VitDWindow | null {
  const above = curve.filter((p) => p.elevation >= threshold);
  if (!above.length) return null;
  return {
    start: above[0].localHours,
    end: above[above.length - 1].localHours,
    peak: Math.max(...curve.map((p) => p.elevation)),
  };
}

export function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

export function dateFromDoy(doy: number): Date {
  const d = new Date(2026, 0);
  d.setDate(doy);
  return d;
}

export function fmtTime(h: number): string {
  const hr = Math.floor(h);
  const mn = Math.round((h - hr) * 60);
  return `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
