"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { searchCities } from "@/lib/cities-api";
import type { City } from "@/lib/types";

interface Props {
  onSelect: (city: City) => void;
  onAddFav: (city: City) => void;
  favorites: string[];
  allCities: City[];
}

export default function CitySearch({ onSelect, onAddFav, favorites, allCities }: Props) {
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<City[]>([]);
  const [nominatimResults, setNominatimResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useTranslations("search");

  // Local match against builtin + custom cities (instant, no network)
  const builtIn = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return allCities.filter((c) => c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)).slice(0, 5);
  }, [query, allCities]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setApiResults([]); setNominatimResults([]); return; }
    setSearching(true);

    searchCities(q).then((results) => {
      setApiResults(results);
    });

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=4&accept-language=es`, { headers: { "User-Agent": "VitD/1" } })
      .then((r) => r.json())
      .then((data) => {
        setNominatimResults(
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
      .catch(() => { setNominatimResults([]); setSearching(false); });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v); setOpen(true); setJustAdded(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Clear "just added" feedback after 2s
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(null), 2000);
    return () => clearTimeout(timer);
  }, [justAdded]);

  // Merge: builtin first, then API results, then nominatim — deduplicate
  const combined = useMemo(() => {
    const seen = new Set<string>();
    const result: City[] = [];
    for (const list of [builtIn, apiResults, nominatimResults]) {
      for (const c of list) {
        const key = `${c.name.toLowerCase()}:${c.lat.toFixed(1)}`;
        if (!seen.has(key)) { seen.add(key); result.push(c); }
        if (result.length >= 10) break;
      }
      if (result.length >= 10) break;
    }
    return result;
  }, [builtIn, apiResults, nominatimResults]);

  const handleGoTo = (c: City) => {
    onSelect(c);
    setQuery("");
    setOpen(false);
  };

  const handleAddFav = (c: City) => {
    onAddFav(c);
    setJustAdded(c.id);
  };

  return (
    <div ref={ref} className="relative flex-[1_1_280px]">
      <div className="flex">
        <input
          value={query} onChange={handleChange} onFocus={() => setOpen(true)}
          placeholder={t("placeholder")}
          className="flex-1 px-3 py-2 rounded-l-lg bg-white/[0.07] border border-white/10 text-white/80 text-sm outline-none focus:border-amber-400/30"
        />
        <div className="px-3 py-2 rounded-r-lg bg-white/[0.05] border border-white/10 border-l-0 text-white/30 text-sm flex items-center">
          {searching ? "⏳" : "🔍"}
        </div>
      </div>
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1 bg-[#141832] border border-white/[0.12] rounded-xl max-h-[350px] overflow-y-auto shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
          {combined.length === 0 && !searching && (
            <div className="p-3 text-sm text-white/30">{t("noResults")}</div>
          )}
          {combined.map((c, i) => {
            const isFav = favorites.includes(c.id);
            const wasJustAdded = justAdded === c.id;
            return (
              <div
                key={`${c.id}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => handleGoTo(c)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleGoTo(c); } }}
                className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.07] cursor-pointer transition-colors"
              >
                {/* City info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{c.flag} {c.name}</div>
                  {(c as { _full?: string })._full && (
                    <div className="text-[10px] text-white/25 truncate max-w-[260px]">
                      {(c as { _full?: string })._full}
                    </div>
                  )}
                  <span className="text-[10px] text-white/20 font-mono">
                    {c.lat.toFixed(2)}°, {c.lon.toFixed(2)}°
                    {c.population ? ` · ${(c.population / 1000).toFixed(0)}K` : ""}
                  </span>
                </div>

                {/* Favorite button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddFav(c); }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isFav || wasJustAdded
                      ? "bg-amber-400/15 text-amber-400"
                      : "bg-white/[0.06] text-white/40 hover:bg-white/[0.1]"
                  }`}
                  title={t("addFavorite")}
                >
                  {wasJustAdded ? `✓ ${t("added")}` : isFav ? "★" : `☆ ${t("fav")}`}
                </button>
              </div>
            );
          })}
          {searching && (
            <div className="p-3 text-xs text-white/30 text-center">{t("searching")}</div>
          )}
        </div>
      )}
    </div>
  );
}
