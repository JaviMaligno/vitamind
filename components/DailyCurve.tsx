"use client";

import { useRef, useCallback } from "react";
import { fmtTime } from "@/lib/solar";
import type { SolarPoint, WeatherData } from "@/lib/types";

interface Props {
  curve: SolarPoint[];
  threshold: number;
  hoverTime: number | null;
  onHover: (h: number | null) => void;
  weather?: WeatherData | null;
}

const W = 860, H = 200;
const PAD = { t: 22, r: 24, b: 32, l: 44 };
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;

function cloudColor(cover: number): string {
  if (cover < 20) return "transparent";
  if (cover < 60) return "rgba(180,180,200,0.08)";
  if (cover < 90) return "rgba(150,150,170,0.15)";
  return "rgba(120,120,140,0.22)";
}

// Build path that only includes visible segments.
// When elevation drops below minE, the path breaks and restarts when it re-enters.
// At entry/exit boundaries, we interpolate the exact crossing point for a clean edge.
function buildVisiblePath(
  curve: SolarPoint[],
  minE: number,
  x: (h: number) => number,
  y: (e: number) => number,
): string {
  const parts: string[] = [];
  let inSegment = false;

  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    const visible = p.elevation >= minE;

    if (visible) {
      if (!inSegment) {
        // Entering visible zone — interpolate entry point if possible
        if (i > 0 && curve[i - 1].elevation < minE) {
          const prev = curve[i - 1];
          const t = (minE - prev.elevation) / (p.elevation - prev.elevation);
          const entryH = prev.localHours + t * (p.localHours - prev.localHours);
          parts.push(`M${x(entryH).toFixed(1)},${y(minE).toFixed(1)}`);
        } else {
          parts.push(`M${x(p.localHours).toFixed(1)},${y(p.elevation).toFixed(1)}`);
        }
        inSegment = true;
      }
      parts.push(`L${x(p.localHours).toFixed(1)},${y(p.elevation).toFixed(1)}`);
    } else {
      if (inSegment) {
        // Exiting visible zone — interpolate exit point
        const prev = curve[i - 1];
        const t = (minE - prev.elevation) / (p.elevation - prev.elevation);
        const exitH = prev.localHours + t * (p.localHours - prev.localHours);
        parts.push(`L${x(exitH).toFixed(1)},${y(minE).toFixed(1)}`);
        inSegment = false;
      }
    }
  }

  return parts.join(" ");
}

export default function DailyCurve({ curve, threshold, hoverTime, onHover, weather }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const maxE = Math.max(55, ...curve.map((p) => Math.max(p.elevation, 0)));
  const minE = Math.max(-15, Math.min(-5, ...curve.map((p) => p.elevation)));
  const range = maxE - minE;
  const x = (h: number) => PAD.l + (h / 24) * plotW;
  const y = (e: number) => PAD.t + plotH - ((e - minE) / range) * plotH;

  const pathD = buildVisiblePath(curve, minE, x, y);

  const aP = curve.filter((p) => p.elevation >= threshold);
  let aD = "";
  if (aP.length > 1) {
    aD = aP.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.localHours).toFixed(1)},${y(p.elevation).toFixed(1)}`).join(" ");
    aD += ` L${x(aP[aP.length - 1].localHours).toFixed(1)},${y(threshold).toFixed(1)} L${x(aP[0].localHours).toFixed(1)},${y(threshold).toFixed(1)} Z`;
  }

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const h = ((e.clientX - r.left) / r.width * W - PAD.l) / plotW * 24;
    if (h >= 0 && h <= 24) onHover(h);
  }, [onHover]);

  const hp = hoverTime !== null ? curve.reduce((a, b) => Math.abs(b.localHours - hoverTime) < Math.abs(a.localHours - hoverTime) ? b : a, curve[0]) : null;

  const cloudRects: { x1: number; x2: number; color: string }[] = [];
  if (weather?.hours) {
    for (const wh of weather.hours) {
      const date = new Date(wh.time);
      const h = date.getHours() + date.getMinutes() / 60;
      const color = cloudColor(wh.cloudCover);
      if (color !== "transparent") {
        cloudRects.push({ x1: x(h), x2: x(h + 1), color });
      }
    }
  }

  // SVG axis label color — uses CSS variable for theme awareness
  const axisLabelColor = "var(--color-text-muted)";
  const gridLineColor = "var(--color-border-subtle)";

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} onMouseMove={handleMove} onMouseLeave={() => onHover(null)}>
      <defs>
        <linearGradient id="sg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1445" /><stop offset="100%" stopColor="#1a237e" />
        </linearGradient>
        <linearGradient id="vg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD54F" stopOpacity=".6" /><stop offset="100%" stopColor="#FF8F00" stopOpacity=".15" />
        </linearGradient>
      </defs>
      <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="url(#sg3)" rx="4" />
      {cloudRects.map((cr, i) => (
        <rect key={i} x={cr.x1} y={PAD.t} width={cr.x2 - cr.x1} height={plotH} fill={cr.color} />
      ))}
      {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
        <g key={h}>
          <line x1={x(h)} y1={PAD.t} x2={x(h)} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.05)" />
          <text x={x(h)} y={PAD.t + plotH + 14} textAnchor="middle" fill={axisLabelColor} fontSize="9" fontFamily="'JetBrains Mono',monospace">{`${h}:00`}</text>
        </g>
      ))}
      {[0, 15, 30, 45, 60].filter((v) => v >= minE && v <= maxE).map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={y(v)} x2={PAD.l + plotW} y2={y(v)} stroke={gridLineColor} />
          <text x={PAD.l - 5} y={y(v) + 3} textAnchor="end" fill={axisLabelColor} fontSize="9" fontFamily="'JetBrains Mono',monospace">{v}&deg;</text>
        </g>
      ))}
      <line x1={PAD.l} y1={y(0)} x2={PAD.l + plotW} y2={y(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3,3" />
      <line x1={PAD.l} y1={y(threshold)} x2={PAD.l + plotW} y2={y(threshold)} stroke="#FF6D00" strokeWidth="1.5" strokeDasharray="6,3" opacity=".8" />
      <text x={PAD.l + plotW + 4} y={y(threshold) + 4} fill="#FFB74D" fontSize="9" fontWeight="600" fontFamily="'JetBrains Mono',monospace">{threshold}&deg;</text>
      {aD && <path d={aD} fill="url(#vg3)" />}
      <path d={pathD} fill="none" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round" />
      {hp && hoverTime !== null && (
        <g>
          <line x1={x(hp.localHours)} y1={PAD.t} x2={x(hp.localHours)} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.2)" strokeDasharray="2,2" />
          <circle cx={x(hp.localHours)} cy={y(Math.max(hp.elevation, minE))} r="5" fill={hp.elevation >= threshold ? "#FFD54F" : "#FF6D00"} stroke="#fff" strokeWidth="1.5" />
          <rect x={x(hp.localHours) - 46} y={PAD.t - 18} width="92" height="16" rx="4" fill="rgba(0,0,0,0.8)" />
          <text x={x(hp.localHours)} y={PAD.t - 7} textAnchor="middle" fill="#FFD54F" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono',monospace">
            {fmtTime(hp.localHours)} &rarr; {hp.elevation.toFixed(1)}&deg;
          </text>
        </g>
      )}
    </svg>
  );
}
