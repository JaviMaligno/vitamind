import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import OAuthConsent from "@/components/OAuthConsent";
import { getOAuthDb, validateAuthorizeRequest, OAuthError } from "@/lib/oauth";

/**
 * OAuth consent screen, reached only via /api/oauth/authorize (which already
 * validated the request — we re-validate here anyway because the URL is
 * user-visible and replayable). Dynamic, never indexed.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function OAuthConsentPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("oauth");
  const sp = await searchParams;

  const request = {
    client_id: first(sp.client_id),
    redirect_uri: first(sp.redirect_uri),
    response_type: first(sp.response_type) || "code",
    scope: first(sp.scope) || undefined,
    code_challenge: first(sp.code_challenge) || undefined,
    code_challenge_method: first(sp.code_challenge_method) || undefined,
  };
  const state = first(sp.state);

  const db = getOAuthDb();
  let clientName: string | null = null;
  let scopes: string[] = [];
  let invalid: string | null = null;

  if (!db) {
    invalid = "temporarily_unavailable";
  } else {
    try {
      const v = await validateAuthorizeRequest(db, request);
      clientName = v.client.client_name;
      scopes = v.scopes;
    } catch (err) {
      invalid = err instanceof OAuthError ? err.code : "server_error";
    }
  }

  if (invalid || !clientName) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("invalidTitle")}</h1>
        <p className="mt-3 text-body text-text-muted">{t("invalidBody")}</p>
        <p className="mt-2 font-mono text-caption text-text-faint">{invalid}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <OAuthConsent
        clientName={clientName}
        scopes={scopes}
        request={{ ...request, state }}
      />
    </main>
  );
}
