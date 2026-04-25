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
    <div className="relative inline-flex items-center gap-1.5" ref={ref}>
      <span className="text-[11px] text-red-400/80">{error}</span>
      {hint && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-4 h-4 rounded-full bg-red-400/15 text-red-400/70 text-[10px] font-semibold flex items-center justify-center hover:bg-red-400/25 transition-colors shrink-0"
            aria-label="Info"
          >
            ?
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-[calc(100vw-2rem)] max-w-xs rounded-xl bg-[#1e1e2e] border border-white/10 shadow-2xl p-3.5 text-[12px] text-neutral-300 leading-relaxed">
              {hint}
            </div>
          )}
        </>
      )}
    </div>
  );
}
