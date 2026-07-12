export default function Chip({
  active, onClick, children,
}: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] px-4 rounded-xl text-caption font-medium transition-colors ${
        active
          ? "bg-possible-surface text-possible border border-possible-border"
          : "bg-glass border border-glass-border text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
