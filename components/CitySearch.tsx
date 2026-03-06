"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { City } from "@/lib/types";

interface Props {
  onSelect: (city: City) => void;
  onAddFav: (city: City) => void;
  favorites: string[];
  allCities: City[];
}

export default function CitySearch({ onSelect, onAddFav, favorites, allCities }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const builtIn = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return allCities.filter((c) => c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)).slice(0, 5);
  }, [query, allCities]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=es`, { headers: { "User-Agent": "VitD/1" } })
      .then((r) => r.json())
      .then((data) => {
        setResults(
          data
            .filter((r: { lat?: string; lon?: string }) => r.lat && r.lon)
            .map((r: { display_name: string; lat: string; lon: string }) => ({
              id: `nominatim:${r.lat}:${r.lon}`,
              name: r.display_name.split(",")[0].trim(),
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon),
              tz: Math.round(parseFloat(r.lon) / 15),
              flag: "\u{1F4CD}",
              source: "nominatim" as const,
              country: r.display_name.split(",").slice(-1)[0]?.trim(),
              _full: r.display_name,
            }))
        );
        setSearching(false);
      })
      .catch(() => { setResults([]); setSearching(false); });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v); setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 500);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const combined = useMemo(() => {
    const s = new Set(builtIn.map((c) => c.name));
    return [...builtIn, ...results.filter((r) => !s.has(r.name))].slice(0, 8);
  }, [builtIn, results]);

  return (
    <div ref={ref} style={{ position: "relative", flex: "1 1 280px" }}>
      <div style={{ display: "flex" }}>
        <input
          value={query} onChange={handleChange} onFocus={() => setOpen(true)}
          placeholder="Buscar cualquier ciudad del mundo..."
          style={{ flex: 1, padding: "7px 12px", borderRadius: "8px 0 0 8px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
        />
        <div style={{ padding: "7px 10px", borderRadius: "0 8px 8px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, display: "flex", alignItems: "center" }}>
          {searching ? "\u23F3" : "\u{1F50D}"}
        </div>
      </div>
      {open && query.length >= 2 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, marginTop: 4, background: "#141832", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, maxHeight: 300, overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}>
          {combined.length === 0 && !searching && (
            <div style={{ padding: 12, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin resultados</div>
          )}
          {combined.map((c, i) => (
            <div
              key={`${c.id}-${i}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#e0e0e0" }}>{c.flag} {c.name}</div>
                {(c as { _full?: string })._full && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                    {(c as { _full?: string })._full}
                  </div>
                )}
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>
                  {c.lat.toFixed(2)}&deg;, {c.lon.toFixed(2)}&deg;
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onAddFav(c); }}
                style={{ padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: favorites.includes(c.id) ? "rgba(255,213,79,0.15)" : "rgba(255,255,255,0.06)", color: favorites.includes(c.id) ? "#FFD54F" : "rgba(255,255,255,0.4)", fontSize: 12 }}
              >
                {favorites.includes(c.id) ? "\u2605" : "\u2606"}
              </button>
            </div>
          ))}
          {searching && (
            <div style={{ padding: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Buscando en OpenStreetMap...</div>
          )}
        </div>
      )}
    </div>
  );
}
