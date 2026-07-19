import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Bot, MessageSquare, TerminalSquare, ShieldCheck, Sun, Sparkles, Lock, Globe,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/i18n/metadata";
import PosterHero from "@/components/PosterHero";
import Card from "@/components/ui/Card";

/**
 * "Connect your AI" — public, shareable documentation for the MCP connector:
 * the two URLs, per-client setup steps, the tool list and a mocked preview of
 * the consent screen (rendered from the real `oauth` strings, so it never
 * drifts from the actual screen). Fully static per locale.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const PUBLIC_URL = "https://getvitamind.app/api/mcp/mcp";
const ACCOUNT_URL = "https://getvitamind.app/api/mcp-auth/mcp";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "connect" });
  const alternates = buildAlternates(locale, "/connect");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: alternates.canonical },
  };
}

function UrlCard({ label, url, text, Icon }: { label: string; url: string; text: string; Icon: LucideIcon }) {
  return (
    <Card variant="glass" className="!p-5 sm:!p-6 space-y-2">
      <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-text-muted">
        <Icon className="h-4 w-4 text-accent shrink-0" aria-hidden /> {label}
      </p>
      <code className="block overflow-x-auto rounded-lg bg-surface-elevated px-3 py-2.5 font-mono text-caption sm:text-body text-text-primary whitespace-nowrap">
        {url}
      </code>
      <p className="text-body text-text-muted">{text}</p>
    </Card>
  );
}

export default async function ConnectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("connect");
  const tOauth = await getTranslations("oauth");

  const clients: { Icon: LucideIcon; title: string; steps: string[] }[] = [
    { Icon: Bot, title: t("claudeTitle"), steps: [t("claudeStep1"), t("claudeStep2"), t("claudeStep3")] },
    { Icon: MessageSquare, title: t("chatgptTitle"), steps: [t("chatgptStep1"), t("chatgptStep2"), t("chatgptStep3")] },
  ];

  const publicTools = [t("toolSearchCity"), t("toolSunTimes"), t("toolWindow"), t("toolYear"), t("toolStatus")];
  const personalTools = [t("toolMyProfile"), t("toolMyCities"), t("toolMyHistory"), t("toolLogSession")];
  const consentScopes = [tOauth("scopeProfileRead"), tOauth("scopeHistoryRead"), tOauth("scopeHistoryWrite")];

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:py-8 space-y-10 sm:space-y-14">
      <PosterHero eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />

      {/* Intro + example prompts */}
      <section className="space-y-4">
        <p className="text-body text-text-secondary leading-relaxed max-w-2xl">{t("intro")}</p>
        <ul className="flex flex-wrap gap-2">
          {[t("exampleQ1"), t("exampleQ2"), t("exampleQ3")].map((q) => (
            <li
              key={q}
              className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass px-4 py-2 text-caption sm:text-body text-text-secondary"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden />
              {q}
            </li>
          ))}
        </ul>
      </section>

      {/* The two URLs */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("urlsHeading")}</h2>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <UrlCard label={t("urlPublicLabel")} url={PUBLIC_URL} text={t("urlPublicText")} Icon={Globe} />
          <UrlCard label={t("urlAccountLabel")} url={ACCOUNT_URL} text={t("urlAccountText")} Icon={Lock} />
        </div>
      </section>

      {/* Per-client instructions */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("clientsHeading")}</h2>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {clients.map((c) => (
            <Card key={c.title} variant="glass" className="!p-5 sm:!p-6">
              <h3 className="flex items-center gap-2 font-display text-title font-bold">
                <c.Icon className="h-5 w-5 text-accent shrink-0" aria-hidden /> {c.title}
              </h3>
              <ol className="mt-3 space-y-2 text-body text-text-secondary">
                {c.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 font-mono text-caption font-semibold text-accent">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
        <Card variant="glass" className="!p-5 sm:!p-6">
          <h3 className="flex items-center gap-2 font-display text-title font-bold">
            <TerminalSquare className="h-5 w-5 text-accent shrink-0" aria-hidden /> {t("othersTitle")}
          </h3>
          <p className="mt-2 text-body text-text-secondary">{t("othersText")}</p>
        </Card>
      </section>

      {/* Consent preview: a decorative mock of the real /oauth-consent screen,
          rendered from the same oauth strings so the docs never drift. */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("consentHeading")}</h2>
        <p className="text-body text-text-muted max-w-2xl">{t("consentText")}</p>
        <div className="max-w-md" aria-hidden>
          <Card variant="glass" className="!p-6 space-y-4 border-2 border-dashed border-border-default">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-accent">
                <Sun className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-title font-bold text-text-primary">
                  {tOauth("title", { client: "Claude" })}
                </p>
                <p className="text-caption text-text-muted">{tOauth("subtitle")}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {consentScopes.map((s) => (
                <li key={s} className="flex items-start gap-2 text-body text-text-secondary">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {s}
                </li>
              ))}
            </ul>
            <div className="pointer-events-none select-none rounded-xl bg-amber-400/80 px-4 py-2.5 text-center text-body font-semibold text-black/80">
              {tOauth("approve", { client: "Claude" })}
            </div>
          </Card>
        </div>
      </section>

      {/* Tool list */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("toolsHeading")}</h2>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card variant="glass" className="!p-5 sm:!p-6">
            <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-text-muted">
              <Globe className="h-4 w-4 text-accent shrink-0" aria-hidden /> {t("toolsPublicHeading")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-body text-text-secondary">
              {publicTools.map((tool) => (
                <li key={tool} className="flex items-start gap-2">
                  <Sun className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden /> {tool}
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="glass" className="!p-5 sm:!p-6">
            <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-text-muted">
              <Lock className="h-4 w-4 text-accent shrink-0" aria-hidden /> {t("toolsPersonalHeading")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-body text-text-secondary">
              {personalTools.map((tool) => (
                <li key={tool} className="flex items-start gap-2">
                  <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden /> {tool}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Privacy + memory tip */}
      <section className="space-y-3 border-t border-border-subtle pt-8">
        <h2 className="font-display text-title sm:text-2xl font-bold">{t("privacyHeading")}</h2>
        <p className="text-body text-text-muted max-w-2xl">{t("privacyText")}</p>
        <p className="text-body text-text-secondary max-w-2xl">{t("memoryTip")}</p>
      </section>
    </main>
  );
}
