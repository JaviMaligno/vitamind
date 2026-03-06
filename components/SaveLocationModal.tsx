"use client";

import { useState } from "react";
import type { City } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  onSave: (city: City) => void;
  onCancel: () => void;
}

export default function SaveLocationModal({ lat, lon, onSave, onCancel }: Props) {
  const [name, setName] = useState("");

  const handleSave = () => {
    const cityName = name.trim() || `${lat.toFixed(1)}\u00B0, ${lon.toFixed(1)}\u00B0`;
    onSave({
      id: `custom:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cityName,
      lat,
      lon,
      tz: Math.round(lon / 15),
      flag: "\u{1F4CD}",
      source: "custom",
    });
  };

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", background: "rgba(0,0,0,0.9)", borderRadius: 6, padding: "4px 8px", border: "1px solid rgba(255,213,79,0.2)" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (opcional)"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        style={{ width: 120, padding: "3px 6px", borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#e0e0e0", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
      />
      <button onClick={handleSave} style={{ padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(255,213,79,0.2)", color: "#FFD54F", fontSize: 10, fontWeight: 600 }}>
        Guardar
      </button>
      <button onClick={onCancel} style={{ padding: "2px 6px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
        &times;
      </button>
    </div>
  );
}
