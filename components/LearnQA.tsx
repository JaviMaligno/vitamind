interface Source {
  label: string;
  url: string;
}

interface QA {
  q: string;
  a: string;
  sources?: Source[];
}

/**
 * Server-rendered Q&A list using native <details>/<summary>. Unlike the old
 * client accordion (which mounted answers only when expanded), the answers
 * always ship in the static HTML — so crawlers index the FAQ body, not just
 * the questions — while <details> still collapses without any JavaScript.
 */
export default function LearnQA({ items, sourcesLabel }: { items: QA[]; sourcesLabel?: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-xl border border-glass-border bg-glass backdrop-blur-md shadow-lg overflow-hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-body font-semibold text-text-primary leading-snug">{item.q}</span>
            <span className="flex-shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="border-t border-glass-border px-5 pb-5 pt-3">
            <p className="text-body text-text-secondary leading-relaxed">{item.a}</p>
            {item.sources && item.sources.length > 0 && (
              <div className="mt-4 border-t border-border-subtle pt-3">
                <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-faint">
                  {sourcesLabel ?? "Sources"}
                </p>
                <ul className="list-none space-y-1.5">
                  {item.sources.map((s, si) => (
                    <li key={si} className="text-caption text-text-muted leading-relaxed">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-text-secondary transition-colors"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
