import { ChevronDown, ExternalLink } from "lucide-react";

interface Source {
  label: string;
  url: string;
}

interface QA {
  q: string;
  a: string;
  sources?: Source[];
}

/** Bare hostname (no www.) — shown as an editorial credibility cue next to each
 *  citation. Falls back to the raw url if it can't be parsed. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Server-rendered Q&A list using native <details>/<summary>. Unlike the old
 * client accordion (which mounted answers only when expanded), the answers
 * always ship in the static HTML — so crawlers index the FAQ body, not just
 * the questions — while <details> still collapses without any JavaScript.
 *
 * Each <details> carries `data-qa` (lowercased question + answer) so the
 * client-side search island on the Learn page can filter this static DOM.
 */
export default function LearnQA({ items, sourcesLabel }: { items: QA[]; sourcesLabel?: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <details
          key={i}
          data-qa={`${item.q} ${item.a}`.toLowerCase()}
          open={i === 0}
          {...(i === 0 ? { "data-qa-default-open": "" } : {})}
          className="group rounded-xl border border-glass-border bg-glass backdrop-blur-md shadow-lg overflow-hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-body font-semibold text-text-primary leading-snug">{item.q}</span>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-glass-border px-5 pb-5 pt-3">
            <p className="text-body text-text-secondary leading-relaxed">{item.a}</p>
            {item.sources && item.sources.length > 0 && (
              <div className="mt-4 border-t border-border-subtle pt-3">
                <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-faint">
                  {sourcesLabel ?? "Sources"}
                </p>
                {/* Editorial citations: each source is a bordered row (not a bare
                    dotted link) with the domain as a credibility cue and a 44px
                    tap target. */}
                <ul className="list-none space-y-2">
                  {item.sources.map((s, si) => (
                    <li key={si}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 transition-colors hover:bg-surface-elevated"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="text-caption font-medium text-text-secondary">{s.label}</span>
                          <span className="text-caption text-text-faint">{hostOf(s.url)}</span>
                        </span>
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
