"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { decodeTopo } from "@/lib/geo";
import { vitDHrs } from "@/lib/solar";
import { MIN_UVI_ELEVATION } from "@/lib/vitd";
import type { City, HoverInfo } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  doy: number;
  onSelect: (city: City) => void;
  favorites: string[];
  allCities: City[];
  scrubMode?: boolean;
}

const W = 860, H = 480;

export default function WorldMap({ lat, lon, doy, onSelect, favorites, allCities, scrubMode = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const viewRef = useRef({ cx: 0, cy: 15, scale: 150 });
  const [, repaint] = useState(0);
  const kick = () => repaint((n) => n + 1);

  const limits = useMemo(() => {
    let n = 0, s = 0;
    for (let la = 0; la <= 90; la += 0.5) {
      if (vitDHrs(la, doy, MIN_UVI_ELEVATION) > 0) n = la;
      if (vitDHrs(-la, doy, MIN_UVI_ELEVATION) > 0) s = -la;
    }
    return { north: n, south: s };
  }, [doy]);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => { setGeoData(decodeTopo(topo, "countries")); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function getProj() {
    const v = viewRef.current;
    return d3.geoEquirectangular().center([v.cx, v.cy]).scale(v.scale).translate([W / 2, H / 2]);
  }

  // Paint canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geoData) return;
    const proj = getProj();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const path = d3.geoPath(proj, ctx);

    ctx.fillStyle = "#090e2a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); path(d3.geoGraticule().step([30, 20])()); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, 0], [180, 0]] } as d3.GeoPermissibleObjects); ctx.stroke();

    if (limits.north > 0 || limits.south < 0) {
      for (let i = 5; i >= 0; i--) {
        const ex = i * 1.5, bn = Math.min(limits.north + ex, 90), bs = Math.max(limits.south - ex, -90);
        ctx.fillStyle = `rgba(255,180,40,${0.02 + (5 - i) * 0.012})`;
        ctx.beginPath();
        path({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-180, bn], [180, bn], [180, bs], [-180, bs], [-180, bn]]] }, properties: {} } as d3.GeoPermissibleObjects);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,109,0,0.5)"; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, limits.north], [180, limits.north]] } as d3.GeoPermissibleObjects); ctx.stroke();
      ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, limits.south], [180, limits.south]] } as d3.GeoPermissibleObjects); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "rgba(200,210,230,0.07)"; ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 0.4;
    for (const f of geoData.features) { ctx.beginPath(); path(f); ctx.fill(); ctx.stroke(); }

    allCities.forEach((city) => {
      const pt = proj([city.lon, city.lat]);
      if (!pt || pt[0] < -10 || pt[0] > W + 10 || pt[1] < -10 || pt[1] > H + 10) return;
      const isFav = favorites.includes(city.id);
      ctx.beginPath(); ctx.arc(pt[0], pt[1], isFav ? 3.5 : 1.3, 0, Math.PI * 2);
      ctx.fillStyle = isFav ? "rgba(255,213,79,0.5)" : "rgba(255,255,255,0.15)"; ctx.fill();
      if (isFav) {
        ctx.strokeStyle = "rgba(255,213,79,0.7)"; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "9px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
        ctx.fillText(`${city.flag || ""} ${city.name}`, pt[0] + 7, pt[1] + 3);
      }
    });

    const sp = proj([lon, lat]);
    if (sp && sp[0] > -50 && sp[0] < W + 50) {
      const grd = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 24);
      grd.addColorStop(0, "rgba(255,213,79,0.45)"); grd.addColorStop(1, "rgba(255,213,79,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sp[0], sp[1], 24, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sp[0], sp[1], 7, 0, Math.PI * 2); ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(sp[0], sp[1], 2.5, 0, Math.PI * 2); ctx.fillStyle = "#FFD54F"; ctx.fill();
    }
  });

  function clientToGeo(cX: number, cY: number): [number, number] | null {
    const el = overlayRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = (cX - r.left) * (W / r.width), py = (cY - r.top) * (H / r.height);
    try { return getProj().invert!([px, py]) as [number, number]; } catch { return null; }
  }

  function clientToSnap(cX: number, cY: number): City | null {
    const el = overlayRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = (cX - r.left) * (W / r.width), py = (cY - r.top) * (H / r.height);
    const proj = getProj();
    let best: City | null = null, bestD = 20;
    allCities.forEach((c) => {
      const pt = proj([c.lon, c.lat]);
      if (!pt) return;
      const d = Math.hypot(pt[0] - px, pt[1] - py);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function doSelect(cX: number, cY: number) {
    const snap = clientToSnap(cX, cY);
    if (snap) { onSelect(snap); return; }
    const geo = clientToGeo(cX, cY);
    if (geo && geo[1] > -80 && geo[1] < 85) {
      onSelect({
        id: `custom:${Date.now()}`,
        name: `${geo[1].toFixed(1)}\u00B0, ${geo[0].toFixed(1)}\u00B0`,
        lat: geo[1], lon: geo[0], tz: Math.round(geo[0] / 15),
        flag: "\u{1F4CD}", source: "custom",
      });
    }
  }

  useEffect(() => {
    const el = overlayRef.current; if (!el) return;
    let drag: { sx: number; sy: number; scx: number; scy: number; moved: boolean } | null = null;
    let pinch: { dist: number; startScale: number } | null = null;

    function touchDist(e: TouchEvent) {
      return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }

    function doPan(dx: number, dy: number) {
      const v = viewRef.current;
      const dpp = (360 / (v.scale * 2 * Math.PI)) * 1.4;
      viewRef.current = { ...v, cx: drag!.scx - dx * dpp, cy: Math.max(-70, Math.min(80, drag!.scy + dy * dpp)) };
      kick();
    }

    function doZoom(factor: number) {
      const v = viewRef.current;
      viewRef.current = { ...v, scale: Math.max(80, Math.min(1200, v.scale * factor)) };
      kick();
    }

    // Mouse
    const onMD = (e: MouseEvent) => {
      if (scrubMode) { doSelect(e.clientX, e.clientY); return; }
      drag = { sx: e.clientX, sy: e.clientY, scx: viewRef.current.cx, scy: viewRef.current.cy, moved: false };
    };
    const onMM = (e: MouseEvent) => {
      if (scrubMode) {
        if (e.buttons === 1) doSelect(e.clientX, e.clientY);
        // hover
        const geo = clientToGeo(e.clientX, e.clientY);
        if (geo && geo[1] > -80 && geo[1] < 85) {
          const snap = clientToSnap(e.clientX, e.clientY);
          setHover(snap ? { lat: snap.lat, lon: snap.lon, name: `${snap.flag || ""} ${snap.name}`, snap } : { lat: geo[1], lon: geo[0], name: `${geo[1].toFixed(1)}\u00B0, ${geo[0].toFixed(1)}\u00B0`, snap: null });
        } else setHover(null);
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) {
          if (e.ctrlKey) { /* ctrl+drag = pan in scrub mode, but we're in pan mode already */ }
          doPan(dx, dy);
        }
      } else {
        const geo = clientToGeo(e.clientX, e.clientY);
        if (geo && geo[1] > -80 && geo[1] < 85) {
          const snap = clientToSnap(e.clientX, e.clientY);
          setHover(snap ? { lat: snap.lat, lon: snap.lon, name: `${snap.flag || ""} ${snap.name}`, snap } : { lat: geo[1], lon: geo[0], name: `${geo[1].toFixed(1)}\u00B0, ${geo[0].toFixed(1)}\u00B0`, snap: null });
        } else setHover(null);
      }
    };
    const onMU = (e: MouseEvent) => {
      if (scrubMode) return;
      if (drag && !drag.moved) doSelect(e.clientX, e.clientY);
      drag = null;
    };
    const onML = () => { drag = null; setHover(null); };
    const onWH = (e: WheelEvent) => { e.preventDefault(); doZoom(e.deltaY > 0 ? 0.9 : 1.12); };

    // Touch
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        drag = null; pinch = { dist: touchDist(e), startScale: viewRef.current.scale };
      } else if (e.touches.length === 1) {
        pinch = null;
        if (scrubMode) { doSelect(e.touches[0].clientX, e.touches[0].clientY); return; }
        const t = e.touches[0];
        drag = { sx: t.clientX, sy: t.clientY, scx: viewRef.current.cx, scy: viewRef.current.cy, moved: false };
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinch) {
        const ratio = touchDist(e) / pinch.dist;
        viewRef.current = { ...viewRef.current, scale: Math.max(80, Math.min(1200, pinch.startScale * ratio)) };
        kick();
      } else if (e.touches.length === 1) {
        if (scrubMode) { doSelect(e.touches[0].clientX, e.touches[0].clientY); return; }
        if (drag) {
          const t = e.touches[0], dx = t.clientX - drag.sx, dy = t.clientY - drag.sy;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
          if (drag.moved) doPan(dx, dy);
        }
      }
    };
    const onTE = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) { pinch = null; drag = null; return; }
      if (!scrubMode && drag && !drag.moved && e.changedTouches.length) {
        doSelect(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      drag = null; pinch = null;
    };

    el.addEventListener("mousedown", onMD); el.addEventListener("mousemove", onMM);
    el.addEventListener("mouseup", onMU); el.addEventListener("mouseleave", onML);
    el.addEventListener("wheel", onWH, { passive: false });
    el.addEventListener("touchstart", onTS, { passive: false }); el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE); el.addEventListener("touchcancel", onTE);
    return () => {
      el.removeEventListener("mousedown", onMD); el.removeEventListener("mousemove", onMM);
      el.removeEventListener("mouseup", onMU); el.removeEventListener("mouseleave", onML);
      el.removeEventListener("wheel", onWH);
      el.removeEventListener("touchstart", onTS); el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE); el.removeEventListener("touchcancel", onTE);
    };
  }, [geoData, scrubMode, allCities]);

  const zoomIn = () => { viewRef.current = { ...viewRef.current, scale: Math.min(1200, viewRef.current.scale * 1.35) }; kick(); };
  const zoomOut = () => { viewRef.current = { ...viewRef.current, scale: Math.max(80, viewRef.current.scale * 0.74) }; kick(); };
  const resetV = () => { viewRef.current = { cx: 0, cy: 15, scale: 150 }; kick(); };

  const proj = getProj();
  const hoverPt = hover ? proj([hover.lon, hover.lat]) : null;

  if (loading) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
        <div>
          <div style={{ fontSize: 24, marginBottom: 8, textAlign: "center" }}>🌍</div>
          <div style={{ fontSize: 13 }}>Cargando mapa del mundo...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: H, display: "block", pointerEvents: "none" }} />
      <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, cursor: scrubMode ? "crosshair" : "grab", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", zIndex: 1 }} />
      {hover && hoverPt && (
        <div style={{ position: "absolute", pointerEvents: "none", zIndex: 2, left: Math.max(8, Math.min((hoverPt[0] / W * 100), 85)) + "%", top: Math.max((hoverPt[1] / H * 100) - 8, 2) + "%", transform: "translate(-50%,-100%)", background: "rgba(0,0,0,0.88)", borderRadius: 6, padding: "5px 10px", border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#FFD54F", whiteSpace: "nowrap" }}>
          {hover.name}{hover.snap && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 6, fontSize: 9 }}>&#x25CF; clic</span>}
        </div>
      )}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 3, zIndex: 5 }}>
        {([
          [zoomIn, "+"],
          [zoomOut, "\u2212"],
          [resetV, "\u27F2"],
        ] as [() => void, string][]).map(([fn, lbl], i) => (
          <button key={i} onClick={fn} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(10,14,42,0.9)", color: "#e0e0e0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{lbl}</button>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 9, color: "rgba(255,255,255,0.25)", pointerEvents: "none", zIndex: 2, background: "rgba(0,0,0,0.4)", padding: "3px 8px", borderRadius: 4 }}>
        {scrubMode ? "Arrastrar: explorar \u00B7 Scroll/Pinch: zoom" : "Arrastrar: mover \u00B7 Scroll/Pinch: zoom \u00B7 Clic/Tap: seleccionar"}
      </div>
    </div>
  );
}
