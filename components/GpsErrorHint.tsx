"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  error: string;
  hint?: string;
}

export default function GpsErrorHint({ error, hint }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      {/* Glass-frost pill (86% surface) so the message stays legible on ANY phase
          gradient. A translucent red *fill* vibrated illegibly ("neon") on the
          bright day phase; here red is only the border + text accent over frost. */}
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-glass backdrop-blur-md px-2.5 py-1.5 text-caption font-medium text-red-600 dark:text-red-300">
        {error}
        {hint && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-caption font-bold text-red-600 dark:text-red-200 hover:bg-red-500/30 transition-colors"
            aria-label="Info"
          >
            ?
          </button>
        )}
      </span>
      {hint && open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[calc(100vw-2rem)] max-w-xs rounded-xl bg-[#1e1e2e] border border-white/10 shadow-2xl p-3.5 text-caption text-neutral-300 leading-relaxed">
          {hint}
        </div>
      )}
    </div>
  );
}
