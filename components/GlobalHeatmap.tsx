"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { vitDHrs, fmtDate, dateFromDoy } from "@/lib/solar";

interface Props {
  selectedLat: number;
  selectedDoy: number;
  threshold: number;
  onSelect: (lat: number, doy: number) => void;
}

const W = 860, H = 360;
const PAD = { t: 20, r: 14, b: 40, l: 50 };
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
const LAT_MIN = -60, LAT_MAX = 70, latCount = 130, doyCount = 183;

export default function GlobalHeatmap({ selectedLat, selectedDoy, threshold, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ lat: number; doy: number; hrs: number } | null>(null);

  const heatData = useMemo(() => {
    const d = new Float32Array(latCount * doyCount);
    for (let li = 0; li < latCount; li++) {
      const lat = LAT_MAX - li;
      for (let di = 0; di < doyCount; di++) d[li * doyCount + di] = vitDHrs(lat, 1 + di * 2, threshold);
    }
    return d;
  }, [threshold]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = W * 2; c.height = H * 2;
    const ctx = c.getContext("2d")!; ctx.scale(2, 2);
    ctx.fillStyle = "#070b1e"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0a0f28"; ctx.fillRect(PAD.l, PAD.t, plotW, plotH);
    const cw = plotW / doyCount, ch = plotH / latCount;
    for (let li = 0; li < latCount; li++) {
      for (let di = 0; di < doyCount; di++) {
        const hrs = heatData[li * doyCount + di];
        if (hrs <= 0) continue;
        const t = Math.min(hrs / 10, 1);
        ctx.fillStyle = `hsl(${45 - t * 25},${80 + t * 20}%,${15 + t * 50}%)`;
        ctx.fillRect(PAD.l + di * cw, PAD.t + li * ch, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
      }
    }
    const mD = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    const mN = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 0.5;
    mD.forEach((d) => { ctx.beginPath(); ctx.moveTo(PAD.l + ((d - 1) / 365) * plotW, PAD.t); ctx.lineTo(PAD.l + ((d - 1) / 365) * plotW, PAD.t + plotH); ctx.stroke(); });
    [-60, -40, -20, 0, 20, 40, 60].forEach((la) => {
      const y = PAD.t + ((LAT_MAX - la) / (LAT_MAX - LAT_MIN)) * plotH;
      ctx.strokeStyle = la === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = la === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + plotW, y); ctx.stroke();
    });
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "10px 'JetBrains Mono',monospace"; ctx.textAlign = "center";
    mD.forEach((d, i) => ctx.fillText(mN[i], PAD.l + ((d + 14) / 365) * plotW, PAD.t + plotH + 16));
    ctx.textAlign = "right";
    [-60, -40, -20, 0, 20, 40, 60].forEach((la) => ctx.fillText(`${la}\u00B0`, PAD.l - 6, PAD.t + ((LAT_MAX - la) / (LAT_MAX - LAT_MIN)) * plotH + 4));
  }, [heatData, threshold]);

  const pxToCoord = useCallback((clientX: number, clientY: number) => {
    const el = overlayRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const mx = (clientX - r.left) * (W / r.width), my = (clientY - r.top) * (H / r.height);
    if (mx < PAD.l || mx > PAD.l + plotW || my < PAD.t || my > PAD.t + plotH) return null;
    return {
      lat: Math.max(LAT_MIN, Math.min(LAT_MAX, LAT_MAX - ((my - PAD.t) / plotH) * (LAT_MAX - LAT_MIN))),
      doy: Math.max(1, Math.min(365, Math.round(1 + ((mx - PAD.l) / plotW) * 364))),
    };
  }, []);

  const stableRef = useRef({ pxToCoord, onSelect, threshold });
  useEffect(() => { stableRef.current = { pxToCoord, onSelect, threshold }; });

  useEffect(() => {
    const el = overlayRef.current; if (!el) return;
    let dragging = false;

    function selectAt(cX: number, cY: number) {
      const { pxToCoord: p, onSelect: sel } = stableRef.current;
      const c = p(cX, cY);
      if (c) sel(c.lat, c.doy);
    }
    function hoverAt(cX: number, cY: number) {
      const { pxToCoord: p, threshold: thr } = stableRef.current;
      const c = p(cX, cY);
      if (c) setHover({ ...c, hrs: vitDHrs(c.lat, c.doy, thr) });
      else setHover(null);
    }

    const onMouseDown = (e: MouseEvent) => { dragging = true; selectAt(e.clientX, e.clientY); };
    const onMouseMove = (e: MouseEvent) => { if (dragging) selectAt(e.clientX, e.clientY); else hoverAt(e.clientX, e.clientY); };
    const onMouseUp = () => { dragging = false; };
    const onMouseLeave = () => { dragging = false; setHover(null); };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); dragging = true; if (e.touches[0]) selectAt(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (dragging && e.touches[0]) selectAt(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd = () => { dragging = false; };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const coordToPx = (la: number, d: number) => ({ x: PAD.l + ((d - 1) / 364) * plotW, y: PAD.t + ((LAT_MAX - la) / (LAT_MAX - LAT_MIN)) * plotH });
  const sp = coordToPx(selectedLat, selectedDoy);
  const hp = hover ? coordToPx(hover.lat, hover.doy) : null;

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 8, pointerEvents: "none" }} />
      <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, cursor: "crosshair", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }} />
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", borderRadius: 8 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={sp.x} y1={PAD.t} x2={sp.x} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4,3" />
        <line x1={PAD.l} y1={sp.y} x2={PAD.l + plotW} y2={sp.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4,3" />
        <circle cx={sp.x} cy={sp.y} r="6" fill="none" stroke="#FFD54F" strokeWidth="2" />
        <circle cx={sp.x} cy={sp.y} r="2" fill="#FFD54F" />
        {hover && hp && (
          <g>
            <line x1={hp.x} y1={PAD.t} x2={hp.x} y2={PAD.t + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth=".5" />
            <line x1={PAD.l} y1={hp.y} x2={PAD.l + plotW} y2={hp.y} stroke="rgba(255,255,255,0.2)" strokeWidth=".5" />
            <rect x={hp.x - 72} y={hp.y - 30} width="144" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth=".5" />
            <text x={hp.x} y={hp.y - 15} textAnchor="middle" fill="#FFD54F" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono',monospace">
              {hover.lat.toFixed(1)}&deg; &middot; {fmtDate(dateFromDoy(hover.doy))} &middot; {hover.hrs > 0 ? `${hover.hrs.toFixed(1)}h` : "0h"}
            </text>
          </g>
        )}
      </svg>
      <div style={{ position: "absolute", bottom: 6, left: PAD.l, fontSize: 9, color: "var(--color-text-faint)", pointerEvents: "none" }}>
        Clic y arrastra para explorar
      </div>
    </div>
  );
}
