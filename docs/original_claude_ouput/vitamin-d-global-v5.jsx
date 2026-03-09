import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as d3 from "d3";

// ═══════════════════════════════════════════════════════════════
// SOLAR MATH
// ═══════════════════════════════════════════════════════════════
const RAD = Math.PI / 180;
function declination(doy) { return 23.44 * Math.sin((360/365)*(doy-81)*RAD); }
function vitDHrs(lat, doy, thr) {
  const d=declination(doy)*RAD, lr=lat*RAD, tr=thr*RAD;
  const cd=Math.cos(lr)*Math.cos(d); if(Math.abs(cd)<1e-10) return 0;
  const cosH=(Math.sin(tr)-Math.sin(lr)*Math.sin(d))/cd;
  if(cosH>=1) return 0; if(cosH<=-1) return 24;
  return (2*Math.acos(cosH)*12)/Math.PI;
}
function solarElev(lat,lon,doy,utcH) {
  const d=declination(doy)*RAD, lr=lat*RAD;
  const B=((360/365)*(doy-81))*RAD;
  const EoT=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  const ha=((utcH-(12-lon/15-EoT/60))*15)*RAD;
  return Math.asin(Math.sin(lr)*Math.sin(d)+Math.cos(lr)*Math.cos(d)*Math.cos(ha))*180/Math.PI;
}
function getCurve(lat,lon,doy,tz) {
  const p=[];for(let m=0;m<=1440;m+=5){const u=m/60,l=u+tz;if(l<0||l>24)continue;p.push({localHours:l,elevation:solarElev(lat,lon,doy,u)});}return p;
}
function getWindow(c,t){const a=c.filter(p=>p.elevation>=t);if(!a.length)return null;return{start:a[0].localHours,end:a[a.length-1].localHours,peak:Math.max(...c.map(p=>p.elevation))};}
function dayOfYear(d){return Math.floor((d-new Date(d.getFullYear(),0,0))/86400000);}
function dateFromDoy(doy){const d=new Date(2026,0);d.setDate(doy);return d;}
function fmtTime(h){const hr=Math.floor(h),mn=Math.round((h-hr)*60);return `${String(hr).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;}
function fmtDate(d){const m=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];return `${d.getDate()} ${m[d.getMonth()]}`;}

// ═══════════════════════════════════════════════════════════════
// TOPOJSON DECODER
// ═══════════════════════════════════════════════════════════════
function decodeTopo(topology, name) {
  const tf = topology.transform;
  const decoded = topology.arcs.map(arc => {
    let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return[x*tf.scale[0]+tf.translate[0],y*tf.scale[1]+tf.translate[1]];});
  });
  function ring(indices){const c=[];for(const idx of indices){const a=idx<0?[...decoded[~idx]].reverse():decoded[idx];for(let i=c.length?1:0;i<a.length;i++)c.push(a[i]);}return c;}
  function geo(g){if(g.type==='Polygon')return{type:'Polygon',coordinates:g.arcs.map(ring)};if(g.type==='MultiPolygon')return{type:'MultiPolygon',coordinates:g.arcs.map(p=>p.map(ring))};return g;}
  const obj=topology.objects[name];
  if(obj.type==='GeometryCollection')return{type:'FeatureCollection',features:obj.geometries.map(g=>({type:'Feature',geometry:geo(g),properties:g.properties||{}}))};
  return{type:'Feature',geometry:geo(obj),properties:obj.properties||{}};
}

// ═══════════════════════════════════════════════════════════════
// BUILT-IN CITIES
// ═══════════════════════════════════════════════════════════════
const BUILT_IN = [
  {n:"Reikiavik",lat:64.15,lon:-21.94,tz:0,c:"🇮🇸"},{n:"Helsinki",lat:60.17,lon:24.94,tz:2,c:"🇫🇮"},
  {n:"Oslo",lat:59.91,lon:10.75,tz:1,c:"🇳🇴"},{n:"Estocolmo",lat:59.33,lon:18.07,tz:1,c:"🇸🇪"},
  {n:"Moscú",lat:55.76,lon:37.62,tz:3,c:"🇷🇺"},{n:"Edimburgo",lat:55.95,lon:-3.19,tz:0,c:"🏴󠁧󠁢󠁳󠁣󠁴󠁿"},
  {n:"Copenhague",lat:55.68,lon:12.57,tz:1,c:"🇩🇰"},{n:"Dublín",lat:53.35,lon:-6.26,tz:0,c:"🇮🇪"},
  {n:"Berlín",lat:52.52,lon:13.41,tz:1,c:"🇩🇪"},{n:"Ámsterdam",lat:52.37,lon:4.90,tz:1,c:"🇳🇱"},
  {n:"Londres",lat:51.51,lon:-0.13,tz:0,c:"🇬🇧"},{n:"Bruselas",lat:50.85,lon:4.35,tz:1,c:"🇧🇪"},
  {n:"París",lat:48.86,lon:2.35,tz:1,c:"🇫🇷"},{n:"Viena",lat:48.21,lon:16.37,tz:1,c:"🇦🇹"},
  {n:"Zúrich",lat:47.37,lon:8.54,tz:1,c:"🇨🇭"},{n:"Budapest",lat:47.50,lon:19.04,tz:1,c:"🇭🇺"},
  {n:"Vancouver",lat:49.28,lon:-123.12,tz:-8,c:"🇨🇦"},{n:"Seattle",lat:47.61,lon:-122.33,tz:-8,c:"🇺🇸"},
  {n:"Toronto",lat:43.65,lon:-79.38,tz:-5,c:"🇨🇦"},{n:"Barcelona",lat:41.39,lon:2.17,tz:1,c:"🇪🇸"},
  {n:"Roma",lat:41.90,lon:12.50,tz:1,c:"🇮🇹"},{n:"Estambul",lat:41.01,lon:28.98,tz:3,c:"🇹🇷"},
  {n:"Chicago",lat:41.88,lon:-87.63,tz:-6,c:"🇺🇸"},{n:"Nueva York",lat:40.71,lon:-74.01,tz:-5,c:"🇺🇸"},
  {n:"Madrid",lat:40.42,lon:-3.70,tz:1,c:"🇪🇸"},{n:"Pekín",lat:39.90,lon:116.40,tz:8,c:"🇨🇳"},
  {n:"Atenas",lat:37.98,lon:23.73,tz:2,c:"🇬🇷"},{n:"Lisboa",lat:38.72,lon:-9.14,tz:0,c:"🇵🇹"},
  {n:"San Francisco",lat:37.77,lon:-122.42,tz:-8,c:"🇺🇸"},{n:"Seúl",lat:37.57,lon:126.98,tz:9,c:"🇰🇷"},
  {n:"Tokio",lat:35.68,lon:139.69,tz:9,c:"🇯🇵"},{n:"Los Ángeles",lat:34.05,lon:-118.24,tz:-8,c:"🇺🇸"},
  {n:"Shanghái",lat:31.23,lon:121.47,tz:8,c:"🇨🇳"},{n:"El Cairo",lat:30.04,lon:31.24,tz:2,c:"🇪🇬"},
  {n:"Delhi",lat:28.61,lon:77.21,tz:5.5,c:"🇮🇳"},{n:"Dubái",lat:25.20,lon:55.27,tz:4,c:"🇦🇪"},
  {n:"Miami",lat:25.76,lon:-80.19,tz:-5,c:"🇺🇸"},{n:"Hong Kong",lat:22.32,lon:114.17,tz:8,c:"🇭🇰"},
  {n:"Ciudad de México",lat:19.43,lon:-99.13,tz:-6,c:"🇲🇽"},{n:"Bangkok",lat:13.76,lon:100.50,tz:7,c:"🇹🇭"},
  {n:"Bogotá",lat:4.71,lon:-74.07,tz:-5,c:"🇨🇴"},{n:"Singapur",lat:1.35,lon:103.82,tz:8,c:"🇸🇬"},
  {n:"Nairobi",lat:-1.29,lon:36.82,tz:3,c:"🇰🇪"},{n:"Lima",lat:-12.05,lon:-77.04,tz:-5,c:"🇵🇪"},
  {n:"São Paulo",lat:-23.55,lon:-46.63,tz:-3,c:"🇧🇷"},{n:"Buenos Aires",lat:-34.60,lon:-58.38,tz:-3,c:"🇦🇷"},
  {n:"Santiago",lat:-33.45,lon:-70.67,tz:-4,c:"🇨🇱"},{n:"Ciudad del Cabo",lat:-33.92,lon:18.42,tz:2,c:"🇿🇦"},
  {n:"Sídney",lat:-33.87,lon:151.21,tz:11,c:"🇦🇺"},{n:"Melbourne",lat:-37.81,lon:144.96,tz:11,c:"🇦🇺"},
  {n:"Auckland",lat:-36.85,lon:174.76,tz:13,c:"🇳🇿"},{n:"Honolulú",lat:21.31,lon:-157.86,tz:-10,c:"🇺🇸"},
  {n:"Anchorage",lat:61.22,lon:-149.90,tz:-9,c:"🇺🇸"},{n:"Tromsø",lat:69.65,lon:18.96,tz:1,c:"🇳🇴"},
  {n:"Sevilla",lat:37.39,lon:-5.98,tz:1,c:"🇪🇸"},{n:"Valencia",lat:39.47,lon:-0.38,tz:1,c:"🇪🇸"},
  {n:"Málaga",lat:36.72,lon:-4.42,tz:1,c:"🇪🇸"},{n:"Las Palmas",lat:28.10,lon:-15.41,tz:0,c:"🇪🇸"},
  {n:"Tenerife",lat:28.47,lon:-16.25,tz:0,c:"🇪🇸"},{n:"Marsella",lat:43.30,lon:5.37,tz:1,c:"🇫🇷"},
  {n:"Taipéi",lat:25.03,lon:121.57,tz:8,c:"🇹🇼"},{n:"Medellín",lat:6.25,lon:-75.56,tz:-5,c:"🇨🇴"},
  {n:"Denver",lat:39.74,lon:-104.99,tz:-7,c:"🇺🇸"},{n:"Phoenix",lat:33.45,lon:-112.07,tz:-7,c:"🇺🇸"},
  {n:"Varsovia",lat:52.23,lon:21.01,tz:1,c:"🇵🇱"},{n:"Johannesburgo",lat:-26.20,lon:28.05,tz:2,c:"🇿🇦"},
  {n:"Perth",lat:-31.95,lon:115.86,tz:8,c:"🇦🇺"},{n:"Lagos",lat:6.52,lon:3.38,tz:1,c:"🇳🇬"},
  {n:"Casablanca",lat:33.57,lon:-7.59,tz:1,c:"🇲🇦"},{n:"Kuala Lumpur",lat:3.14,lon:101.69,tz:8,c:"🇲🇾"},
  {n:"Montevideo",lat:-34.88,lon:-56.16,tz:-3,c:"🇺🇾"},{n:"Bombay",lat:19.08,lon:72.88,tz:5.5,c:"🇮🇳"},
  {n:"Praga",lat:50.08,lon:14.44,tz:1,c:"🇨🇿"},
].sort((a,b)=>a.n.localeCompare(b.n));

const DEFAULT_FAVS = ["Londres","Madrid","Estocolmo","Nueva York","Tokio","Nairobi","Sídney","Bogotá","Reikiavik","Ciudad del Cabo"];

// ═══════════════════════════════════════════════════════════════
// WORLD MAP — ref-based view, counter-triggered repaint, native events
// ═══════════════════════════════════════════════════════════════
function WorldMapReal({ lat, lon, doy, threshold, onSelect, favorites, allCities }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);
  // View lives in a ref (always fresh for handlers) + counter to trigger repaint
  const viewRef = useRef({ cx: 0, cy: 15, scale: 150 });
  const [, repaint] = useState(0);
  const kick = () => repaint(n => n + 1);

  const W = 860, H = 480;

  const limits = useMemo(() => {
    let n = 0, s = 0;
    for (let la = 0; la <= 90; la += .5) { if (vitDHrs(la, doy, threshold) > 0) n = la; if (vitDHrs(-la, doy, threshold) > 0) s = -la; }
    return { north: n, south: s };
  }, [doy, threshold]);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json()).then(topo => { setGeoData(decodeTopo(topo, "countries")); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build projection from current ref
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
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    const path = d3.geoPath(proj, ctx);

    ctx.fillStyle = "#090e2a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); path(d3.geoGraticule().step([30, 20])()); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, 0], [180, 0]] }); ctx.stroke();

    if (limits.north > 0 || limits.south < 0) {
      for (let i = 5; i >= 0; i--) {
        const ex = i * 1.5, bn = Math.min(limits.north + ex, 90), bs = Math.max(limits.south - ex, -90);
        ctx.fillStyle = `rgba(255,180,40,${0.02 + (5 - i) * 0.012})`;
        ctx.beginPath(); path({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-180, bn], [180, bn], [180, bs], [-180, bs], [-180, bn]]] } }); ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,109,0,0.5)"; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, limits.north], [180, limits.north]] }); ctx.stroke();
      ctx.beginPath(); path({ type: "LineString", coordinates: [[-180, limits.south], [180, limits.south]] }); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(200,210,230,0.07)"; ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 0.4;
    for (const f of geoData.features) { ctx.beginPath(); path(f); ctx.fill(); ctx.stroke(); }

    allCities.forEach(city => {
      const pt = proj([city.lon, city.lat]);
      if (!pt || pt[0] < -10 || pt[0] > W + 10 || pt[1] < -10 || pt[1] > H + 10) return;
      const isFav = favorites.includes(city.n);
      ctx.beginPath(); ctx.arc(pt[0], pt[1], isFav ? 3.5 : 1.3, 0, Math.PI * 2);
      ctx.fillStyle = isFav ? "rgba(255,213,79,0.5)" : "rgba(255,255,255,0.15)"; ctx.fill();
      if (isFav) {
        ctx.strokeStyle = "rgba(255,213,79,0.7)"; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "9px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
        ctx.fillText(`${city.c} ${city.n}`, pt[0] + 7, pt[1] + 3);
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
  }); // runs every render

  // Helpers — always use fresh proj
  function clientToGeo(cX, cY) {
    const el = overlayRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = (cX - r.left) * (W / r.width), py = (cY - r.top) * (H / r.height);
    try { return getProj().invert([px, py]); } catch { return null; }
  }
  function clientToSnap(cX, cY) {
    const el = overlayRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = (cX - r.left) * (W / r.width), py = (cY - r.top) * (H / r.height);
    const proj = getProj();
    let best = null, bestD = 20;
    allCities.forEach(c => { const pt = proj([c.lon, c.lat]); if (!pt) return; const d = Math.hypot(pt[0] - px, pt[1] - py); if (d < bestD) { bestD = d; best = c; } });
    return best;
  }
  function doSelect(cX, cY) {
    const snap = clientToSnap(cX, cY);
    if (snap) { onSelect(snap); return; }
    const geo = clientToGeo(cX, cY);
    if (geo && geo[1] > -80 && geo[1] < 85)
      onSelect({ n: `${geo[1].toFixed(1)}°, ${geo[0].toFixed(1)}°`, lat: geo[1], lon: geo[0], tz: Math.round(geo[0] / 15), c: "📍" });
  }

  // ─── Native event listeners ───
  useEffect(() => {
    const el = overlayRef.current; if (!el) return;
    let drag = null;  // {sx, sy, scx, scy, moved}
    let pinch = null; // {dist, startScale}

    function touchDist(e) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }

    function doPan(dx, dy) {
      const v = viewRef.current;
      const dpp = 360 / (v.scale * 2 * Math.PI) * 1.4;
      viewRef.current = { ...v, cx: drag.scx - dx * dpp, cy: Math.max(-70, Math.min(80, drag.scy + dy * dpp)) };
      kick();
    }
    function doZoom(factor) {
      const v = viewRef.current;
      viewRef.current = { ...v, scale: Math.max(80, Math.min(1200, v.scale * factor)) };
      kick();
    }

    // Mouse
    const onMD = (e) => { drag = { sx: e.clientX, sy: e.clientY, scx: viewRef.current.cx, scy: viewRef.current.cy, moved: false }; };
    const onMM = (e) => {
      if (drag) {
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) doPan(dx, dy);
      } else {
        const geo = clientToGeo(e.clientX, e.clientY);
        if (geo && geo[1] > -80 && geo[1] < 85) {
          const snap = clientToSnap(e.clientX, e.clientY);
          setHover(snap ? { lat: snap.lat, lon: snap.lon, name: `${snap.c} ${snap.n}`, snap } : { lat: geo[1], lon: geo[0], name: `${geo[1].toFixed(1)}°, ${geo[0].toFixed(1)}°`, snap: null });
        } else setHover(null);
      }
    };
    const onMU = (e) => { if (drag && !drag.moved) doSelect(e.clientX, e.clientY); drag = null; };
    const onML = () => { drag = null; setHover(null); };
    const onWH = (e) => { e.preventDefault(); doZoom(e.deltaY > 0 ? 0.9 : 1.12); };

    // Touch
    const onTS = (e) => {
      e.preventDefault();
      if (e.touches.length === 2) { drag = null; pinch = { dist: touchDist(e), startScale: viewRef.current.scale }; }
      else if (e.touches.length === 1) { pinch = null; const t = e.touches[0]; drag = { sx: t.clientX, sy: t.clientY, scx: viewRef.current.cx, scy: viewRef.current.cy, moved: false }; }
    };
    const onTM = (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinch) {
        const ratio = touchDist(e) / pinch.dist;
        viewRef.current = { ...viewRef.current, scale: Math.max(80, Math.min(1200, pinch.startScale * ratio)) };
        kick();
      } else if (e.touches.length === 1 && drag) {
        const t = e.touches[0], dx = t.clientX - drag.sx, dy = t.clientY - drag.sy;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) doPan(dx, dy);
      }
    };
    const onTE = (e) => {
      if (pinch && e.touches.length < 2) { pinch = null; drag = null; return; }
      if (drag && !drag.moved && e.changedTouches.length) doSelect(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
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
  }, [geoData]); // re-run when map loads

  const zoomIn = () => { viewRef.current = { ...viewRef.current, scale: Math.min(1200, viewRef.current.scale * 1.35) }; kick(); };
  const zoomOut = () => { viewRef.current = { ...viewRef.current, scale: Math.max(80, viewRef.current.scale * 0.74) }; kick(); };
  const resetV = () => { viewRef.current = { cx: 0, cy: 15, scale: 150 }; kick(); };

  const proj = getProj();
  const hoverPt = hover ? proj([hover.lon, hover.lat]) : null;

  if (loading) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}><div><div style={{ fontSize: 24, marginBottom: 8, textAlign: "center" }}>🌍</div><div style={{ fontSize: 13 }}>Cargando mapa del mundo...</div></div></div>;

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: H, display: "block", pointerEvents: "none" }} />
      <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, cursor: "crosshair", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", zIndex: 1 }} />
      {hover && hoverPt && (
        <div style={{ position: "absolute", pointerEvents: "none", zIndex: 2, left: Math.max(8, Math.min((hoverPt[0] / W * 100), 85)) + "%", top: Math.max((hoverPt[1] / H * 100) - 8, 2) + "%", transform: "translate(-50%,-100%)", background: "rgba(0,0,0,0.88)", borderRadius: 6, padding: "5px 10px", border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#FFD54F", whiteSpace: "nowrap" }}>
          {hover.name}{hover.snap && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 6, fontSize: 9 }}>● clic</span>}
        </div>
      )}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 3, zIndex: 5 }}>
        {[[zoomIn, "+"], [zoomOut, "−"], [resetV, "⟲"]].map(([fn, lbl], i) => (
          <button key={i} onClick={fn} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(10,14,42,0.9)", color: "#e0e0e0", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{lbl}</button>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 9, color: "rgba(255,255,255,0.25)", pointerEvents: "none", zIndex: 2, background: "rgba(0,0,0,0.4)", padding: "3px 8px", borderRadius: 4 }}>
        Arrastrar: mover · Scroll/Pinch: zoom · Clic/Tap: seleccionar
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL HEATMAP — drag to scrub
// ═══════════════════════════════════════════════════════════════
function GlobalHeatmap({ selectedLat, selectedDoy, threshold, onSelect }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [hover, setHover] = useState(null);
  const W=860,H=360,PAD={t:20,r:14,b:40,l:50};
  const plotW=W-PAD.l-PAD.r, plotH=H-PAD.t-PAD.b;
  const LAT_MIN=-60,LAT_MAX=70,latCount=130,doyCount=183;

  const heatData = useMemo(()=>{
    const d=new Float32Array(latCount*doyCount);
    for(let li=0;li<latCount;li++){const lat=LAT_MAX-li;for(let di=0;di<doyCount;di++)d[li*doyCount+di]=vitDHrs(lat,1+di*2,threshold);}
    return d;
  },[threshold]);

  useEffect(()=>{
    const c=canvasRef.current;if(!c)return;c.width=W*2;c.height=H*2;const ctx=c.getContext("2d");ctx.scale(2,2);
    ctx.fillStyle="#070b1e";ctx.fillRect(0,0,W,H);ctx.fillStyle="#0a0f28";ctx.fillRect(PAD.l,PAD.t,plotW,plotH);
    const cw=plotW/doyCount,ch=plotH/latCount;
    for(let li=0;li<latCount;li++)for(let di=0;di<doyCount;di++){const hrs=heatData[li*doyCount+di];if(hrs<=0)continue;const t=Math.min(hrs/10,1);ctx.fillStyle=`hsl(${45-t*25},${80+t*20}%,${15+t*50}%)`;ctx.fillRect(PAD.l+di*cw,PAD.t+li*ch,Math.ceil(cw)+.5,Math.ceil(ch)+.5);}
    const mD=[1,32,60,91,121,152,182,213,244,274,305,335],mN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    ctx.strokeStyle="rgba(255,255,255,0.06)";ctx.lineWidth=.5;mD.forEach(d=>{ctx.beginPath();ctx.moveTo(PAD.l+((d-1)/365)*plotW,PAD.t);ctx.lineTo(PAD.l+((d-1)/365)*plotW,PAD.t+plotH);ctx.stroke();});
    [-60,-40,-20,0,20,40,60].forEach(la=>{const y=PAD.t+((LAT_MAX-la)/(LAT_MAX-LAT_MIN))*plotH;ctx.strokeStyle=la===0?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.06)";ctx.lineWidth=la===0?1:.5;ctx.beginPath();ctx.moveTo(PAD.l,y);ctx.lineTo(PAD.l+plotW,y);ctx.stroke();});
    ctx.fillStyle="rgba(255,255,255,0.35)";ctx.font="10px 'JetBrains Mono',monospace";ctx.textAlign="center";
    mD.forEach((d,i)=>ctx.fillText(mN[i],PAD.l+((d+14)/365)*plotW,PAD.t+plotH+16));
    ctx.textAlign="right";[-60,-40,-20,0,20,40,60].forEach(la=>ctx.fillText(`${la}°`,PAD.l-6,PAD.t+((LAT_MAX-la)/(LAT_MAX-LAT_MIN))*plotH+4));
  },[heatData,threshold]);

  const pxToCoord = useCallback((clientX,clientY)=>{
    const el=overlayRef.current; if(!el) return null;
    const r=el.getBoundingClientRect();
    const mx=(clientX-r.left)*(W/r.width), my=(clientY-r.top)*(H/r.height);
    if(mx<PAD.l||mx>PAD.l+plotW||my<PAD.t||my>PAD.t+plotH) return null;
    return {
      lat:Math.max(LAT_MIN,Math.min(LAT_MAX,LAT_MAX-((my-PAD.t)/plotH)*(LAT_MAX-LAT_MIN))),
      doy:Math.max(1,Math.min(365,Math.round(1+((mx-PAD.l)/plotW)*364)))
    };
  },[]);

  // Native event listeners for reliable mobile support
  const stableHeatRef = useRef({ pxToCoord: ()=>null, onSelect: ()=>{}, threshold: 50 });
  useEffect(() => { stableHeatRef.current = { pxToCoord, onSelect, threshold }; });

  useEffect(() => {
    const el = overlayRef.current; if (!el) return;
    let dragging = false;

    function selectAt(cX, cY) {
      const { pxToCoord: p, onSelect: sel } = stableHeatRef.current;
      const c = p(cX, cY);
      if (c) sel(c.lat, c.doy);
    }
    function hoverAt(cX, cY) {
      const { pxToCoord: p, threshold: thr } = stableHeatRef.current;
      const c = p(cX, cY);
      if (c) setHover({ ...c, hrs: vitDHrs(c.lat, c.doy, thr) });
      else setHover(null);
    }

    // Mouse
    function onMouseDown(e) { dragging = true; selectAt(e.clientX, e.clientY); }
    function onMouseMove(e) { if (dragging) selectAt(e.clientX, e.clientY); else hoverAt(e.clientX, e.clientY); }
    function onMouseUp() { dragging = false; }
    function onMouseLeave() { dragging = false; setHover(null); }

    // Touch
    function onTouchStart(e) { e.preventDefault(); dragging = true; if (e.touches[0]) selectAt(e.touches[0].clientX, e.touches[0].clientY); }
    function onTouchMove(e) { e.preventDefault(); if (dragging && e.touches[0]) selectAt(e.touches[0].clientX, e.touches[0].clientY); }
    function onTouchEnd() { dragging = false; }

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

  const coordToPx=(la,d)=>({x:PAD.l+((d-1)/364)*plotW,y:PAD.t+((LAT_MAX-la)/(LAT_MAX-LAT_MIN))*plotH});
  const sp=coordToPx(selectedLat,selectedDoy);
  const hp=hover?coordToPx(hover.lat,hover.doy):null;

  return (
    <div style={{position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",display:"block",borderRadius:8,pointerEvents:"none"}}/>
      {/* Overlay — native handlers */}
      <div ref={overlayRef} style={{position:"absolute",top:0,left:0,right:0,bottom:0,cursor:"crosshair",
        touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}} />
      {/* SVG crosshairs rendered on top */}
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",borderRadius:8}} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={sp.x} y1={PAD.t} x2={sp.x} y2={PAD.t+plotH} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4,3"/>
        <line x1={PAD.l} y1={sp.y} x2={PAD.l+plotW} y2={sp.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4,3"/>
        <circle cx={sp.x} cy={sp.y} r="6" fill="none" stroke="#FFD54F" strokeWidth="2"/><circle cx={sp.x} cy={sp.y} r="2" fill="#FFD54F"/>
        {hover&&hp&&<g>
          <line x1={hp.x} y1={PAD.t} x2={hp.x} y2={PAD.t+plotH} stroke="rgba(255,255,255,0.2)" strokeWidth=".5"/>
          <line x1={PAD.l} y1={hp.y} x2={PAD.l+plotW} y2={hp.y} stroke="rgba(255,255,255,0.2)" strokeWidth=".5"/>
          <rect x={hp.x-72} y={hp.y-30} width="144" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.1)" strokeWidth=".5"/>
          <text x={hp.x} y={hp.y-15} textAnchor="middle" fill="#FFD54F" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono',monospace">
            {hover.lat.toFixed(1)}° · {fmtDate(dateFromDoy(hover.doy))} · {hover.hrs>0?`${hover.hrs.toFixed(1)}h`:"0h"}
          </text>
        </g>}
      </svg>
      <div style={{position:"absolute",bottom:6,left:PAD.l,fontSize:9,color:"rgba(255,255,255,0.2)",pointerEvents:"none"}}>
        Clic y arrastra para explorar
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DAILY CURVE
// ═══════════════════════════════════════════════════════════════
function DailyCurve({curve,threshold,hoverTime,onHover}) {
  const W=860,H=200,PAD={t:22,r:24,b:32,l:44};const plotW=W-PAD.l-PAD.r,plotH=H-PAD.t-PAD.b;const ref=useRef(null);
  const maxE=Math.max(55,...curve.map(p=>Math.max(p.elevation,0))),minE=Math.min(-5,...curve.map(p=>p.elevation)),range=maxE-minE;
  const x=h=>PAD.l+(h/24)*plotW,y=e=>PAD.t+plotH-((e-minE)/range)*plotH;
  const pathD=curve.filter(p=>p.elevation>minE).map((p,i)=>`${i===0?"M":"L"}${x(p.localHours).toFixed(1)},${y(p.elevation).toFixed(1)}`).join(" ");
  const aP=curve.filter(p=>p.elevation>=threshold);let aD="";
  if(aP.length>1){aD=aP.map((p,i)=>`${i===0?"M":"L"}${x(p.localHours).toFixed(1)},${y(p.elevation).toFixed(1)}`).join(" ");aD+=` L${x(aP[aP.length-1].localHours).toFixed(1)},${y(threshold).toFixed(1)} L${x(aP[0].localHours).toFixed(1)},${y(threshold).toFixed(1)} Z`;}
  const handleMove=useCallback((e)=>{if(!ref.current)return;const r=ref.current.getBoundingClientRect();const h=((e.clientX-r.left)/r.width*W-PAD.l)/plotW*24;if(h>=0&&h<=24)onHover(h);},[onHover]);
  const hp=hoverTime!==null?curve.reduce((a,b)=>Math.abs(b.localHours-hoverTime)<Math.abs(a.localHours-hoverTime)?b:a,curve[0]):null;
  return(
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{width:"100%"}} onMouseMove={handleMove} onMouseLeave={()=>onHover(null)}>
      <defs><linearGradient id="sg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0c1445"/><stop offset="100%" stopColor="#1a237e"/></linearGradient>
      <linearGradient id="vg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFD54F" stopOpacity=".6"/><stop offset="100%" stopColor="#FF8F00" stopOpacity=".15"/></linearGradient></defs>
      <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="url(#sg3)" rx="4"/>
      {[0,3,6,9,12,15,18,21,24].map(h=><g key={h}><line x1={x(h)} y1={PAD.t} x2={x(h)} y2={PAD.t+plotH} stroke="rgba(255,255,255,0.05)"/><text x={x(h)} y={PAD.t+plotH+14} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="'JetBrains Mono',monospace">{`${h}:00`}</text></g>)}
      {[0,15,30,45,60].filter(v=>v>=minE&&v<=maxE).map(v=><g key={v}><line x1={PAD.l} y1={y(v)} x2={PAD.l+plotW} y2={y(v)} stroke="rgba(255,255,255,0.05)"/><text x={PAD.l-5} y={y(v)+3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="'JetBrains Mono',monospace">{v}°</text></g>)}
      <line x1={PAD.l} y1={y(0)} x2={PAD.l+plotW} y2={y(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3,3"/>
      <line x1={PAD.l} y1={y(threshold)} x2={PAD.l+plotW} y2={y(threshold)} stroke="#FF6D00" strokeWidth="1.5" strokeDasharray="6,3" opacity=".8"/>
      <text x={PAD.l+plotW+4} y={y(threshold)+4} fill="#FFB74D" fontSize="9" fontWeight="600" fontFamily="'JetBrains Mono',monospace">{threshold}°</text>
      {aD&&<path d={aD} fill="url(#vg3)"/>}
      <path d={pathD} fill="none" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round"/>
      {hp&&hoverTime!==null&&<g>
        <line x1={x(hp.localHours)} y1={PAD.t} x2={x(hp.localHours)} y2={PAD.t+plotH} stroke="rgba(255,255,255,0.2)" strokeDasharray="2,2"/>
        <circle cx={x(hp.localHours)} cy={y(Math.max(hp.elevation,minE))} r="5" fill={hp.elevation>=threshold?"#FFD54F":"#FF6D00"} stroke="#fff" strokeWidth="1.5"/>
        <rect x={x(hp.localHours)-46} y={PAD.t-18} width="92" height="16" rx="4" fill="rgba(0,0,0,0.8)"/>
        <text x={x(hp.localHours)} y={PAD.t-7} textAnchor="middle" fill="#FFD54F" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono',monospace">{fmtTime(hp.localHours)} → {hp.elevation.toFixed(1)}°</text>
      </g>}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// CITY SEARCH (Nominatim + builtin)
// ═══════════════════════════════════════════════════════════════
function CitySearch({onSelect,onAddFav,favorites,allCities}) {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [open,setOpen]=useState(false);
  const [searching,setSearching]=useState(false);
  const ref=useRef(null);const timerRef=useRef(null);

  const builtIn=useMemo(()=>{
    if(!query.trim())return[];
    const q=query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    return allCities.filter(c=>c.n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(q)).slice(0,5);
  },[query,allCities]);

  const doSearch=useCallback((q)=>{
    if(q.length<2){setResults([]);return;}
    setSearching(true);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=es`,{headers:{"User-Agent":"VitD/1"}})
      .then(r=>r.json()).then(data=>{
        setResults(data.filter(r=>r.lat&&r.lon).map(r=>({n:r.display_name.split(",")[0].trim(),lat:parseFloat(r.lat),lon:parseFloat(r.lon),tz:Math.round(parseFloat(r.lon)/15),c:"📍",full:r.display_name,fromApi:true})));
        setSearching(false);
      }).catch(()=>{setResults([]);setSearching(false);});
  },[]);

  const handleChange=(e)=>{const v=e.target.value;setQuery(v);setOpen(true);clearTimeout(timerRef.current);timerRef.current=setTimeout(()=>doSearch(v),500);};
  useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const combined=useMemo(()=>{const s=new Set(builtIn.map(c=>c.n));return[...builtIn,...results.filter(r=>!s.has(r.n))].slice(0,8);},[builtIn,results]);

  return(
    <div ref={ref} style={{position:"relative",flex:"1 1 280px"}}>
      <div style={{display:"flex"}}>
        <input value={query} onChange={handleChange} onFocus={()=>setOpen(true)} placeholder="Buscar cualquier ciudad del mundo..."
          style={{flex:1,padding:"7px 12px",borderRadius:"8px 0 0 8px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#e0e0e0",fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
        <div style={{padding:"7px 10px",borderRadius:"0 8px 8px 0",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderLeft:"none",color:"rgba(255,255,255,0.3)",fontSize:12,display:"flex",alignItems:"center"}}>{searching?"⏳":"🔍"}</div>
      </div>
      {open&&query.length>=2&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,marginTop:4,background:"#141832",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,maxHeight:300,overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,0.7)"}}>
          {combined.length===0&&!searching&&<div style={{padding:12,fontSize:12,color:"rgba(255,255,255,0.3)"}}>Sin resultados</div>}
          {combined.map((c,i)=>(
            <div key={`${c.n}-${i}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              onClick={()=>{onSelect(c);setQuery("");setOpen(false);}}>
              <div style={{minWidth:0}}><div style={{fontSize:13,color:"#e0e0e0"}}>{c.c} {c.n}</div>
                {c.full&&<div style={{fontSize:9,color:"rgba(255,255,255,0.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:260}}>{c.full}</div>}
                <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"'JetBrains Mono',monospace"}}>{c.lat.toFixed(2)}°, {c.lon.toFixed(2)}°</span>
              </div>
              <button onClick={e=>{e.stopPropagation();onAddFav(c);}} style={{padding:"2px 8px",borderRadius:4,border:"none",cursor:"pointer",
                background:favorites.includes(c.n)?"rgba(255,213,79,0.15)":"rgba(255,255,255,0.06)",
                color:favorites.includes(c.n)?"#FFD54F":"rgba(255,255,255,0.4)",fontSize:12}}>{favorites.includes(c.n)?"★":"☆"}</button>
            </div>
          ))}
          {searching&&<div style={{padding:10,fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>Buscando en OpenStreetMap...</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [lat,setLat]=useState(51.51);const [lon,setLon]=useState(-0.13);const [tz,setTz]=useState(0);
  const [doy,setDoy]=useState(dayOfYear(new Date(2026,2,5)));
  const [threshold,setThreshold]=useState(50);
  const [cityName,setCityName]=useState("Londres");const [cityFlag,setCityFlag]=useState("🇬🇧");
  const [hoverTime,setHoverTime]=useState(null);
  const [animating,setAnimating]=useState(false);
  const [favorites,setFavorites]=useState(DEFAULT_FAVS);
  const [extraCities,setExtraCities]=useState([]);
  const [editingFavs,setEditingFavs]=useState(false);
  const [tab,setTab]=useState("map");
  const animRef=useRef(null);

  const allCities=useMemo(()=>{const s=new Set(BUILT_IN.map(c=>c.n));return[...BUILT_IN,...extraCities.filter(c=>!s.has(c.n))].sort((a,b)=>a.n.localeCompare(b.n));},[extraCities]);
  const date=dateFromDoy(doy);
  const curve=useMemo(()=>getCurve(lat,lon,doy,tz),[lat,lon,doy,tz]);
  const vitDWindow=useMemo(()=>getWindow(curve,threshold),[curve,threshold]);
  const peak=useMemo(()=>Math.max(...curve.map(p=>p.elevation)),[curve]);
  const vdH=vitDHrs(lat,doy,threshold);

  const selectCity=useCallback((c)=>{
    setLat(c.lat);setLon(c.lon);setTz(c.tz);setCityName(c.n);setCityFlag(c.c||"📍");
    if(c.fromApi&&!BUILT_IN.find(b=>b.n===c.n))setExtraCities(p=>p.find(x=>x.n===c.n)?p:[...p,{n:c.n,lat:c.lat,lon:c.lon,tz:c.tz,c:c.c||"📍"}]);
  },[]);

  const selectFromHeatmap=useCallback((newLat,newDoy)=>{
    const rL=Math.round(newLat*10)/10;setLat(rL);setDoy(Math.max(1,Math.min(365,Math.round(newDoy))));
    let near=null,minD=999;BUILT_IN.forEach(c=>{const d=Math.abs(c.lat-rL);if(d<minD){minD=d;near=c;}});
    if(near&&minD<3){setLon(near.lon);setTz(near.tz);setCityName(near.n);setCityFlag(near.c);}
    else{setCityName(`Lat ${Math.round(rL)}°`);setCityFlag("📍");}
  },[]);

  const toggleFav=useCallback((c)=>{
    const name=typeof c==="string"?c:c.n;
    setFavorites(f=>f.includes(name)?f.filter(x=>x!==name):[...f,name]);
    if(typeof c!=="string"&&c.fromApi)setExtraCities(p=>p.find(x=>x.n===c.n)?p:[...p,{n:c.n,lat:c.lat,lon:c.lon,tz:c.tz,c:c.c||"📍"}]);
  },[]);

  const toggleAnim=()=>{if(animating){cancelAnimationFrame(animRef.current);setAnimating(false);}else{setAnimating(true);const s=()=>{setDoy(d=>d>=365?1:d+1);animRef.current=requestAnimationFrame(s);};animRef.current=requestAnimationFrame(s);}};
  useEffect(()=>()=>cancelAnimationFrame(animRef.current),[]);

  const isCurrentFav=favorites.includes(cityName);
  const sI={padding:"7px 8px",borderRadius:8,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#e0e0e0",fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:"none",width:65,boxSizing:"border-box"};

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(155deg,#050816 0%,#0a0e27 30%,#0d1233 60%,#080c20 100%)",color:"#e0e0e0",fontFamily:"'DM Sans',sans-serif",padding:"20px 12px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet"/>

      <div style={{maxWidth:880,margin:"0 auto 14px"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <span style={{fontSize:30,fontWeight:800,letterSpacing:"-1px",fontFamily:"'Playfair Display',serif",background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Vitamina D</span>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontWeight:500}}>Explorador Solar Global</span>
        </div>
      </div>

      <div style={{maxWidth:880,margin:"0 auto 10px",background:vdH>0?"linear-gradient(135deg,rgba(255,213,79,0.06),rgba(255,111,0,0.03))":"linear-gradient(135deg,rgba(255,60,60,0.06),rgba(120,30,30,0.03))",borderRadius:10,padding:"12px 16px",border:`1px solid ${vdH>0?"rgba(255,213,79,0.12)":"rgba(255,60,60,0.1)"}`,display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:16,fontWeight:700,color:vdH>0?"#FFD54F":"#ef5350"}}>{vdH>0?"☀️ Síntesis posible":"🌙 Sin vitamina D"}</span>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:600}}>{cityFlag} {cityName}</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>· {fmtDate(date)} · Pico: {peak.toFixed(1)}° · {lat.toFixed(1)}°, {lon.toFixed(1)}°</span>
          {!isCurrentFav&&cityName&&<button onClick={()=>toggleFav(cityName)} style={{padding:"2px 10px",borderRadius:12,border:"none",cursor:"pointer",background:"rgba(255,213,79,0.1)",color:"#FFD54F",fontSize:10,fontWeight:600}}>☆ Añadir favorito</button>}
        </div>
        {vitDWindow&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:600,color:"#FFD54F"}}>{fmtTime(vitDWindow.start)} – {fmtTime(vitDWindow.end)}<span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{Math.round((vitDWindow.end-vitDWindow.start)*60)}min</span></div>}
      </div>

      <div style={{maxWidth:880,margin:"0 auto 10px",background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8,alignItems:"center"}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:1,marginRight:4}}>Favoritos:</span>
          {favorites.map(fn=>{const c=allCities.find(x=>x.n===fn);if(!c)return null;const isSel=cityName===fn;
            return(<div key={fn} style={{display:"flex",alignItems:"center"}}>
              <button onClick={()=>selectCity(c)} style={{padding:"3px 8px",borderRadius:editingFavs?"10px 0 0 10px":10,border:"none",cursor:"pointer",background:isSel?"rgba(255,213,79,0.18)":"rgba(255,255,255,0.04)",color:isSel?"#FFD54F":"rgba(255,255,255,0.35)",fontSize:10,fontWeight:isSel?600:400,fontFamily:"'DM Sans',sans-serif"}}>{c.c} {fn}</button>
              {editingFavs&&<button onClick={()=>toggleFav(fn)} style={{padding:"3px 5px",borderRadius:"0 10px 10px 0",border:"none",cursor:"pointer",background:"rgba(255,60,60,0.1)",color:"#ef5350",fontSize:9}}>✕</button>}
            </div>);})}
          <button onClick={()=>setEditingFavs(!editingFavs)} style={{padding:"3px 8px",borderRadius:10,border:"none",cursor:"pointer",background:editingFavs?"rgba(255,213,79,0.1)":"rgba(255,255,255,0.04)",color:editingFavs?"#FFD54F":"rgba(255,255,255,0.2)",fontSize:9}}>{editingFavs?"✓ Listo":"✎ Editar"}</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
          <CitySearch onSelect={selectCity} onAddFav={toggleFav} favorites={favorites} allCities={allCities}/>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>Lat</span>
            <input value={lat} onChange={e=>{setLat(parseFloat(e.target.value)||0);setCityName(`${e.target.value}°`);setCityFlag("📍");}} style={sI}/>
            <span style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>Lon</span>
            <input value={lon} onChange={e=>{setLon(parseFloat(e.target.value)||0);setTz(Math.round((parseFloat(e.target.value)||0)/15));}} style={sI}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,flex:"1 1 180px"}}>
            <button onClick={()=>setDoy(d=>Math.max(1,d-1))} style={{padding:"4px 6px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.06)",color:"#e0e0e0",cursor:"pointer",fontSize:10}}>◀</button>
            <input type="range" min="1" max="365" value={doy} onChange={e=>setDoy(parseInt(e.target.value))} style={{flex:1,accentColor:"#FFD54F",height:4}}/>
            <button onClick={()=>setDoy(d=>Math.min(365,d+1))} style={{padding:"4px 6px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.06)",color:"#e0e0e0",cursor:"pointer",fontSize:10}}>▶</button>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#FFD54F",minWidth:50}}>{fmtDate(date)}</span>
            <button onClick={toggleAnim} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",background:animating?"rgba(255,80,80,0.15)":"rgba(255,213,79,0.1)",color:animating?"#ef5350":"#FFD54F",fontSize:10,fontWeight:600}}>{animating?"⏸":"▶ Animar"}</button>
          </div>
          <div style={{display:"flex",gap:3}}>
            {[45,50].map(t=><button key={t} onClick={()=>setThreshold(t)} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",background:threshold===t?"rgba(255,213,79,0.15)":"rgba(255,255,255,0.04)",color:threshold===t?"#FFD54F":"rgba(255,255,255,0.35)",fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:threshold===t?600:400}}>{t}°</button>)}
          </div>
        </div>
      </div>

      <div style={{maxWidth:880,margin:"0 auto 6px",display:"flex",gap:4}}>
        {[["map","🌍 Mapa Mundi"],["heatmap","📊 Latitud × Año"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"6px 18px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",background:tab===k?"rgba(255,255,255,0.05)":"transparent",color:tab===k?"#FFD54F":"rgba(255,255,255,0.25)",fontWeight:tab===k?600:400,fontSize:12,fontFamily:"'DM Sans',sans-serif",borderBottom:tab===k?"2px solid #FFD54F":"2px solid transparent"}}>{l}</button>
        ))}
      </div>

      <div style={{maxWidth:880,margin:"0 auto"}}>
        {tab==="map"&&<div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 6px 6px",border:"1px solid rgba(255,255,255,0.05)",marginBottom:10}}>
          <WorldMapReal lat={lat} lon={lon} doy={doy} threshold={threshold} onSelect={selectCity} favorites={favorites} allCities={allCities}/>
        </div>}
        {tab==="heatmap"&&<div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 6px 6px",border:"1px solid rgba(255,255,255,0.05)",marginBottom:10}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4,paddingLeft:8}}><strong style={{color:"rgba(255,255,255,0.45)"}}>HEATMAP GLOBAL</strong> · Latitud × Día del año · Horas ≥ {threshold}° · <em>Clic y arrastra para explorar</em></div>
          <GlobalHeatmap selectedLat={lat} selectedDoy={doy} threshold={threshold} onSelect={selectFromHeatmap}/>
        </div>}
        <div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 6px 6px",border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4,paddingLeft:8}}><strong style={{color:"rgba(255,255,255,0.45)"}}>CURVA DEL DÍA</strong> · {cityFlag} {cityName} · {fmtDate(date)}</div>
          <DailyCurve curve={curve} threshold={threshold} hoverTime={hoverTime} onHover={setHoverTime}/>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:12,marginTop:8,padding:"5px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)",fontSize:9,color:"rgba(255,255,255,0.22)"}}>
          <span>Horas Vit D:</span><div style={{width:100,height:6,borderRadius:3,background:"linear-gradient(90deg,#0a0f28,#4a2800,#b36200,#e6a100,#FFD54F)"}}/><span style={{fontFamily:"'JetBrains Mono',monospace"}}>0h → 10h+</span>
          <span><span style={{display:"inline-block",width:12,height:1.5,background:"#FF6D00",marginRight:4,verticalAlign:"middle"}}/>Límite Vit D</span>
        </div>
      </div>
      <div style={{maxWidth:880,margin:"12px auto 0",fontSize:9,color:"rgba(255,255,255,0.15)",lineHeight:1.5}}>Cálculos astronómicos (cielo despejado). Mapa: Natural Earth. Búsqueda: OpenStreetMap Nominatim. Umbral 45° (in vitro) / 50° (conservador).</div>
    </div>
  );
}
