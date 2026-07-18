"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface Props {
  error: string;
  hint?: string;
  onDismiss?: () => void;
}

export default function GpsErrorHint({ error, hint, onDismiss }: Props) {
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // The GPS button sits mid-row on mobile, so a popover anchored to it (right-0)
  // ran off the left edge. Position it fixed and clamp to the viewport instead.
  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        const width = Math.min(288, window.innerWidth - 24);
        let left = r.right - width;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        setPos({ left, top: r.bottom + 6, width });
      }
      return next;
    });
  }, []);

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
            ref={btnRef}
            onClick={toggle}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-caption font-bold text-red-600 dark:text-red-200 hover:bg-red-500/30 transition-colors"
            aria-label="Info"
          >
            ?
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-caption font-bold text-red-600/70 dark:text-red-200/70 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-200 transition-colors"
            aria-label={tNav("close")}
          >
            ×
          </button>
        )}
      </span>
      {hint && open && pos && (
        <div
          className="fixed z-50 rounded-xl bg-[#1e1e2e] border border-white/10 shadow-2xl p-3.5 text-caption text-neutral-300 leading-relaxed"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
