"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

/**
 * Sticky search + latitude jump-bar for the city index. The index page is a
 * SERVER component (SSG) so every city link ships in the static HTML for SEO —
 * this island must NOT re-render that list. Instead it filters the existing,
 * server-rendered DOM: each city `<li>` carries `data-city` (its lowercased
 * name) and lives in a `[data-band-section]`. On input we toggle `hidden` on
 * non-matching items and on any band that ends up empty. Those nodes are static
 * HTML (server components don't hydrate), so touching their classList is safe.
 */
export default function CityIndexSearch({
  bands,
  placeholder,
  noResults,
  clearLabel,
}: {
  bands: { id: string; short: string }[];
  placeholder: string;
  noResults: string;
  clearLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const applyFilter = useCallback((raw: string) => {
    const term = raw.trim().toLowerCase();
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;

    let anyVisible = false;
    doc.querySelectorAll<HTMLElement>("[data-band-section]").forEach((section) => {
      let sectionHas = false;
      section.querySelectorAll<HTMLElement>("[data-city]").forEach((li) => {
        const match = !term || (li.dataset.city ?? "").includes(term);
        li.hidden = !match;
        if (match) sectionHas = true;
      });
      section.hidden = !sectionHas;
      if (sectionHas) anyVisible = true;
    });
    setEmpty(!anyVisible);
  }, []);

  const onChange = useCallback((v: string) => {
    setQuery(v);
    applyFilter(v);
  }, [applyFilter]);

  const clear = useCallback(() => onChange(""), [onChange]);

  const jump = useCallback((id: string) => {
    const el = rootRef.current?.ownerDocument.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={rootRef} className="sticky top-2 z-20 -mx-4 px-4 sm:top-4">
      <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-md p-2 shadow-lg space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-h-[44px] w-full rounded-xl bg-surface-input pl-10 pr-10 text-body text-text-primary placeholder:text-text-faint outline-none focus-visible:ring-2 focus-visible:ring-sun"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label={clearLabel}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Latitude jump bar — hidden while filtering (the sections it points at
            may be collapsed). */}
        {!query && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {bands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => jump(b.id)}
                className="min-h-[36px] shrink-0 rounded-lg bg-surface-elevated px-3 text-caption font-semibold text-text-secondary hover:bg-surface-input transition-colors"
              >
                {b.short}
              </button>
            ))}
          </div>
        )}
      </div>

      {empty && (
        <p className="mt-3 text-center text-body text-text-muted">{noResults}</p>
      )}
    </div>
  );
}
