export interface PillOption { key: string; label: string }

export default function Pills({
  options, active, onSelect,
}: { options: PillOption[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onSelect(o.key)}
          className={`min-h-[40px] px-4 rounded-full text-caption font-semibold transition-colors ${
            o.key === active
              ? "bg-surface text-sun-strong"
              : "bg-glass border border-glass-border text-text-secondary hover:text-text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
