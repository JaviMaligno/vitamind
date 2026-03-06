"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import WorldMap from "@/components/WorldMap";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import DailyCurve from "@/components/DailyCurve";
import CitySearch from "@/components/CitySearch";
import SaveLocationModal from "@/components/SaveLocationModal";
import VitDEstimate from "@/components/VitDEstimate";
import SkinSelector from "@/components/SkinSelector";
import NotificationToggle from "@/components/NotificationToggle";
import { BUILTIN_CITIES, findNearestCity } from "@/lib/cities";
import { vitDHrs, getCurve, getWindow, dayOfYear, dateFromDoy, fmtTime, fmtDate } from "@/lib/solar";
import { loadFavorites, saveFavorites, loadCustomLocations, saveCustomLocation, deleteCustomLocation, loadPreferences, savePreferences, getCachedWeather, setCachedWeather } from "@/lib/storage";
import type { City, WeatherData } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

export default function App() {
  // State
  const [lat, setLat] = useState(51.51);
  const [lon, setLon] = useState(-0.13);
  const [tz, setTz] = useState(0);
  const [doy, setDoy] = useState(dayOfYear(new Date()));
  const [threshold, setThreshold] = useState(50);
  const [cityName, setCityName] = useState("Londres");
  const [cityFlag, setCityFlag] = useState("\u{1F1EC}\u{1F1E7}");
  const [cityId, setCityId] = useState("builtin:londres");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customLocations, setCustomLocations] = useState<City[]>([]);
  const [editingFavs, setEditingFavs] = useState(false);
  const [tab, setTab] = useState<"map" | "heatmap">("map");
  const [scrubMode, setScrubMode] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [skinType, setSkinType] = useState<SkinType>(3);
  const [areaFraction, setAreaFraction] = useState(0.25);
  const animRef = useRef<number>(0);

  // Load persisted state on mount
  useEffect(() => {
    setFavorites(loadFavorites());
    setCustomLocations(loadCustomLocations());
    const prefs = loadPreferences();
    setThreshold(prefs.threshold);
    if (prefs.skinType) setSkinType(prefs.skinType);
    if (prefs.areaFraction) setAreaFraction(prefs.areaFraction);
  }, []);

  // Persist favorites
  useEffect(() => {
    if (favorites.length > 0) saveFavorites(favorites);
  }, [favorites]);

  // Persist threshold
  useEffect(() => {
    savePreferences({ threshold, lastCityId: cityId, skinType, areaFraction });
  }, [threshold, cityId, skinType, areaFraction]);

  // All cities = builtin + custom
  const allCities = useMemo(() => {
    const s = new Set(BUILTIN_CITIES.map((c) => c.id));
    return [...BUILTIN_CITIES, ...customLocations.filter((c) => !s.has(c.id))].sort((a, b) => a.name.localeCompare(b.name));
  }, [customLocations]);

  const date = dateFromDoy(doy);
  const curve = useMemo(() => getCurve(lat, lon, doy, tz), [lat, lon, doy, tz]);
  const vitDWindow = useMemo(() => getWindow(curve, threshold), [curve, threshold]);
  const peak = useMemo(() => Math.max(...curve.map((p) => p.elevation)), [curve]);
  const vdH = vitDHrs(lat, doy, threshold);

  // Fetch weather
  useEffect(() => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const cached = getCachedWeather(lat, lon, dateStr);
    if (cached) { setWeather(cached); return; }

    const controller = new AbortController();
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&date=${dateStr}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.hours) {
          const wd: WeatherData = { hours: data.hours, fetchedAt: Date.now() };
          setCachedWeather(lat, lon, dateStr, wd);
          setWeather(wd);
        } else {
          setWeather(null);
        }
      })
      .catch(() => setWeather(null));
    return () => controller.abort();
  }, [lat, lon, date]);

  const selectCity = useCallback((c: City) => {
    setLat(c.lat); setLon(c.lon); setTz(c.tz);
    setCityName(c.name); setCityFlag(c.flag || "\u{1F4CD}"); setCityId(c.id);
    if (c.source === "nominatim" && !BUILTIN_CITIES.find((b) => b.id === c.id)) {
      setCustomLocations((prev) => {
        if (prev.find((x) => x.id === c.id)) return prev;
        const updated = [...prev, c];
        saveCustomLocation(c);
        return updated;
      });
    }
  }, []);

  const selectFromHeatmap = useCallback((newLat: number, newDoy: number) => {
    const rL = Math.round(newLat * 10) / 10;
    setLat(rL); setDoy(Math.max(1, Math.min(365, Math.round(newDoy))));
    const near = findNearestCity(rL, BUILTIN_CITIES);
    if (near) {
      setLon(near.lon); setTz(near.tz); setCityName(near.name); setCityFlag(near.flag || "\u{1F4CD}"); setCityId(near.id);
    } else {
      setLon(0); setTz(0);
      setCityName(`Lat ${Math.round(rL)}\u00B0`); setCityFlag("\u{1F4CD}"); setCityId(`custom:lat-${rL}`);
    }
  }, []);

  const toggleFav = useCallback((c: City | string) => {
    const id = typeof c === "string" ? c : c.id;
    setFavorites((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
    if (typeof c !== "string" && c.source !== "builtin") {
      setCustomLocations((prev) => {
        if (prev.find((x) => x.id === c.id)) return prev;
        saveCustomLocation(c);
        return [...prev, c];
      });
    }
  }, []);

  const handleSaveLocation = useCallback((city: City) => {
    saveCustomLocation(city);
    setCustomLocations((prev) => [...prev.filter((c) => c.id !== city.id), city]);
    setFavorites((f) => f.includes(city.id) ? f : [...f, city.id]);
    setCityName(city.name); setCityFlag(city.flag || "\u{1F4CD}"); setCityId(city.id);
    setSavingLocation(false);
  }, []);

  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomLocation(id);
    setCustomLocations((prev) => prev.filter((c) => c.id !== id));
    setFavorites((f) => f.filter((x) => x !== id));
  }, []);

  const toggleAnim = () => {
    if (animating) { cancelAnimationFrame(animRef.current); setAnimating(false); }
    else {
      setAnimating(true);
      const s = () => { setDoy((d) => d >= 365 ? 1 : d + 1); animRef.current = requestAnimationFrame(s); };
      animRef.current = requestAnimationFrame(s);
    }
  };
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const isCurrentFav = favorites.includes(cityId);
  const sI: React.CSSProperties = { padding: "7px 8px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#e0e0e0", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: 65, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(155deg,#050816 0%,#0a0e27 30%,#0d1233 60%,#080c20 100%)", color: "#e0e0e0", fontFamily: "'DM Sans',sans-serif", padding: "20px 12px" }}>
      {/* Header */}
      <div style={{ maxWidth: 880, margin: "0 auto 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px", fontFamily: "'Playfair Display',serif", background: "linear-gradient(135deg,#FFD54F,#FF8F00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Vitamina D</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Explorador Solar Global</span>
        </div>
      </div>

      {/* Status banner */}
      <div style={{ maxWidth: 880, margin: "0 auto 10px", background: vdH > 0 ? "linear-gradient(135deg,rgba(255,213,79,0.06),rgba(255,111,0,0.03))" : "linear-gradient(135deg,rgba(255,60,60,0.06),rgba(120,30,30,0.03))", borderRadius: 10, padding: "12px 16px", border: `1px solid ${vdH > 0 ? "rgba(255,213,79,0.12)" : "rgba(255,60,60,0.1)"}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: vdH > 0 ? "#FFD54F" : "#ef5350" }}>
            {vdH > 0 ? "\u2600\uFE0F Sintesis posible" : "\u{1F319} Sin vitamina D"}
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{cityFlag} {cityName}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>&middot; {fmtDate(date)} &middot; Pico: {peak.toFixed(1)}&deg; &middot; {lat.toFixed(1)}&deg;, {lon.toFixed(1)}&deg;</span>
          {!isCurrentFav && cityName && (
            <button onClick={() => toggleFav(cityId)} style={{ padding: "2px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "rgba(255,213,79,0.1)", color: "#FFD54F", fontSize: 10, fontWeight: 600 }}>
              &#x2606; Favorito
            </button>
          )}
          <button onClick={() => setSavingLocation(true)} style={{ padding: "2px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
            Guardar como...
          </button>
          <NotificationToggle lat={lat} lon={lon} tz={tz} skinType={skinType} areaFraction={areaFraction} threshold={threshold} cityName={cityName} />
        </div>
        {vitDWindow && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 600, color: "#FFD54F" }}>
            {fmtTime(vitDWindow.start)} &ndash; {fmtTime(vitDWindow.end)}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>{Math.round((vitDWindow.end - vitDWindow.start) * 60)}min</span>
          </div>
        )}
      </div>

      {/* Save location inline */}
      {savingLocation && (
        <div style={{ maxWidth: 880, margin: "0 auto 10px" }}>
          <SaveLocationModal lat={lat} lon={lon} onSave={handleSaveLocation} onCancel={() => setSavingLocation(false)} />
        </div>
      )}

      {/* Controls panel */}
      <div style={{ maxWidth: 880, margin: "0 auto 10px", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Favorites */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Favoritos:</span>
          {favorites.map((fid) => {
            const c = allCities.find((x) => x.id === fid);
            if (!c) return null;
            const isSel = cityId === fid;
            return (
              <div key={fid} style={{ display: "flex", alignItems: "center" }}>
                <button onClick={() => selectCity(c)} style={{ padding: "3px 8px", borderRadius: editingFavs ? "10px 0 0 10px" : 10, border: "none", cursor: "pointer", background: isSel ? "rgba(255,213,79,0.18)" : "rgba(255,255,255,0.04)", color: isSel ? "#FFD54F" : "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: isSel ? 600 : 400, fontFamily: "'DM Sans',sans-serif" }}>
                  {c.flag} {c.name}
                </button>
                {editingFavs && (
                  <button onClick={() => { toggleFav(fid); if (c.source === "custom") handleDeleteCustom(fid); }} style={{ padding: "3px 5px", borderRadius: "0 10px 10px 0", border: "none", cursor: "pointer", background: "rgba(255,60,60,0.1)", color: "#ef5350", fontSize: 9 }}>
                    &#x2715;
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => setEditingFavs(!editingFavs)} style={{ padding: "3px 8px", borderRadius: 10, border: "none", cursor: "pointer", background: editingFavs ? "rgba(255,213,79,0.1)" : "rgba(255,255,255,0.04)", color: editingFavs ? "#FFD54F" : "rgba(255,255,255,0.2)", fontSize: 9 }}>
            {editingFavs ? "\u2713 Listo" : "\u270E Editar"}
          </button>
        </div>

        {/* Skin & area personalization */}
        <SkinSelector skinType={skinType} areaFraction={areaFraction} onSkinChange={setSkinType} onAreaChange={setAreaFraction} />

        {/* Search + controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <CitySearch onSelect={selectCity} onAddFav={(c) => toggleFav(c)} favorites={favorites} allCities={allCities} />
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Lat</span>
            <input value={lat} onChange={(e) => { setLat(parseFloat(e.target.value) || 0); setCityName(`${e.target.value}\u00B0`); setCityFlag("\u{1F4CD}"); }} style={sI} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Lon</span>
            <input value={lon} onChange={(e) => { setLon(parseFloat(e.target.value) || 0); setTz(Math.round((parseFloat(e.target.value) || 0) / 15)); }} style={sI} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 180px" }}>
            <button onClick={() => setDoy((d) => Math.max(1, d - 1))} style={{ padding: "4px 6px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: "#e0e0e0", cursor: "pointer", fontSize: 10 }}>&#x25C0;</button>
            <input type="range" min="1" max="365" value={doy} onChange={(e) => setDoy(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#FFD54F", height: 4 }} />
            <button onClick={() => setDoy((d) => Math.min(365, d + 1))} style={{ padding: "4px 6px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", color: "#e0e0e0", cursor: "pointer", fontSize: 10 }}>&#x25B6;</button>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#FFD54F", minWidth: 50 }}>{fmtDate(date)}</span>
            <button onClick={toggleAnim} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: animating ? "rgba(255,80,80,0.15)" : "rgba(255,213,79,0.1)", color: animating ? "#ef5350" : "#FFD54F", fontSize: 10, fontWeight: 600 }}>
              {animating ? "\u23F8" : "\u25B6 Animar"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {[45, 50].map((t) => (
              <button key={t} onClick={() => setThreshold(t)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: threshold === t ? "rgba(255,213,79,0.15)" : "rgba(255,255,255,0.04)", color: threshold === t ? "#FFD54F" : "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: threshold === t ? 600 : 400 }}>
                {t}&deg;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ maxWidth: 880, margin: "0 auto 6px", display: "flex", gap: 4 }}>
        {([["map", "\u{1F30D} Mapa Mundi"], ["heatmap", "\u{1F4CA} Latitud \u00D7 A\u00F1o"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "6px 18px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", background: tab === k ? "rgba(255,255,255,0.05)" : "transparent", color: tab === k ? "#FFD54F" : "rgba(255,255,255,0.25)", fontWeight: tab === k ? 600 : 400, fontSize: 12, fontFamily: "'DM Sans',sans-serif", borderBottom: tab === k ? "2px solid #FFD54F" : "2px solid transparent" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {tab === "map" && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 6px 6px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, paddingRight: 8 }}>
              <button onClick={() => setScrubMode(!scrubMode)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: scrubMode ? "rgba(255,213,79,0.15)" : "rgba(255,255,255,0.04)", color: scrubMode ? "#FFD54F" : "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: scrubMode ? 600 : 400 }}>
                {scrubMode ? "\u{1F50D} Explorar" : "\u270B Mover"}
              </button>
            </div>
            <WorldMap lat={lat} lon={lon} doy={doy} threshold={threshold} onSelect={selectCity} favorites={favorites} allCities={allCities} scrubMode={scrubMode} />
          </div>
        )}
        {tab === "heatmap" && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 6px 6px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, paddingLeft: 8 }}>
              <strong style={{ color: "rgba(255,255,255,0.45)" }}>HEATMAP GLOBAL</strong> &middot; Latitud &times; Dia del a&ntilde;o &middot; Horas &ge; {threshold}&deg; &middot; <em>Clic y arrastra para explorar</em>
            </div>
            <GlobalHeatmap selectedLat={lat} selectedDoy={doy} threshold={threshold} onSelect={selectFromHeatmap} />
          </div>
        )}

        {/* Daily curve */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 6px 6px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, paddingLeft: 8 }}>
            <strong style={{ color: "rgba(255,255,255,0.45)" }}>CURVA DEL DIA</strong> &middot; {cityFlag} {cityName} &middot; {fmtDate(date)}
            {weather && <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.2)" }}>&middot; Con datos meteorologicos</span>}
          </div>
          <DailyCurve curve={curve} threshold={threshold} hoverTime={hoverTime} onHover={setHoverTime} weather={weather} />
        </div>

        {/* Vitamin D estimate */}
        <VitDEstimate
          weather={weather}
          skinType={skinType}
          areaFraction={areaFraction}
        />

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 8, padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 9, color: "rgba(255,255,255,0.22)" }}>
          <span>Horas Vit D:</span>
          <div style={{ width: 100, height: 6, borderRadius: 3, background: "linear-gradient(90deg,#0a0f28,#4a2800,#b36200,#e6a100,#FFD54F)" }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>0h &rarr; 10h+</span>
          <span><span style={{ display: "inline-block", width: 12, height: 1.5, background: "#FF6D00", marginRight: 4, verticalAlign: "middle" }} />Limite Vit D</span>
          {weather && <span><span style={{ display: "inline-block", width: 12, height: 6, background: "rgba(150,150,170,0.3)", marginRight: 4, verticalAlign: "middle", borderRadius: 2 }} />Nubes</span>}
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "12px auto 0", fontSize: 9, color: "rgba(255,255,255,0.15)", lineHeight: 1.5 }}>
        Calculos astronomicos + datos UV reales (Open-Meteo). Estimacion Vit D basada en Holick/Dowdy (2010). Mapa: Natural Earth. Busqueda: OpenStreetMap Nominatim. Umbral 45&deg; (in vitro) / 50&deg; (conservador).
      </div>
    </div>
  );
}
