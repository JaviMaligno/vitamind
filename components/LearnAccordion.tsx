"use client";

import { useState } from "react";

interface QA {
  q: string;
  a: string;
}

interface Props {
  items: QA[];
}

export default function LearnAccordion({ items }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="border border-border-subtle rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-surface-card hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <span className="text-[13px] font-medium text-text-primary leading-snug">{item.q}</span>
            <span className={`text-text-faint text-[11px] flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-border-subtle">
              <p className="text-[12px] text-text-muted leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
