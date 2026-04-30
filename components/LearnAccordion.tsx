"use client";

import { useState } from "react";

interface Source {
  label: string;
  url: string;
}

interface QA {
  q: string;
  a: string;
  sources?: Source[];
}

interface Props {
  items: QA[];
  sourcesLabel?: string;
}

export default function LearnAccordion({ items, sourcesLabel }: Props) {
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
              {item.sources && item.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-subtle">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">
                    {sourcesLabel ?? "Sources"}
                  </p>
                  <ul className="space-y-1 list-none">
                    {item.sources.map((s, si) => (
                      <li key={si} className="text-[11px] text-text-muted leading-relaxed">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-text-secondary underline decoration-dotted underline-offset-2 transition-colors"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
