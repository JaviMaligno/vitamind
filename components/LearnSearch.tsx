"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

/**
 * Sticky search for the Learn FAQ. The Learn page is a SERVER component (SSG) so
 * every Q&A ships in the static HTML for SEO — this island must not re-render
 * it. It filters the server-rendered DOM: each <details> carries `data-qa`
 * (lowercased question + answer) and lives in a `[data-qa-block]` section; on
 * input we toggle `hidden` on non-matching Q&A and on any block left empty, and
 * force-open the matches so the hit is readable. Those nodes are static HTML
 * (server components don't hydrate), so touching them is safe.
 */
export default function LearnSearch({
  placeholder,
  noResults,
  clearLabel,
}: {
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
    doc.querySelectorAll<HTMLElement>("[data-qa-block]").forEach((block) => {
      let blockHas = false;
      block.querySelectorAll<HTMLDetailsElement>("[data-qa]").forEach((d) => {
        const match = !term || (d.dataset.qa ?? "").includes(term);
        d.hidden = !match;
        // Open matches while searching (so the answer is visible); collapse
        // everything when the query clears (all questions start collapsed).
        d.open = !!term && match;
        if (match) blockHas = true;
      });
      block.hidden = !blockHas;
      if (blockHas) anyVisible = true;
    });
    setEmpty(!anyVisible);
  }, []);

  const onChange = useCallback((v: string) => {
    setQuery(v);
    applyFilter(v);
  }, [applyFilter]);

  const clear = useCallback(() => onChange(""), [onChange]);

  return (
    <div ref={rootRef} className="sticky top-2 z-20 mb-6 sm:top-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-[44px] w-full rounded-xl bg-glass border border-glass-border backdrop-blur-md pl-10 pr-12 text-body text-text-primary placeholder:text-text-faint shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-sun"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label={clearLabel}
            className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {empty && (
        <p className="mt-3 text-center text-body text-text-muted">{noResults}</p>
      )}
    </div>
  );
}
