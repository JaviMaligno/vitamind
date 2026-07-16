import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFoundPage");

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-heading font-bold text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body text-text-secondary">{t("message")}</p>
      <Link
        href="/"
        className="mt-2 rounded-xl border border-glass-border bg-glass px-6 py-3 text-body font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
      >
        {t("home")}
      </Link>
    </main>
  );
}
