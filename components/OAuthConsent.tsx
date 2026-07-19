"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Sun } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import AuthButton from "@/components/AuthButton";
import Card from "@/components/ui/Card";
import PhaseButton from "@/components/PhaseButton";

interface Props {
  clientName: string;
  scopes: string[];
  request: {
    client_id: string;
    redirect_uri: string;
    scope?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    state: string;
  };
}

/** i18n key per scope id ("profile:read" → scopeProfileRead). */
const SCOPE_KEY: Record<string, string> = {
  "profile:read": "scopeProfileRead",
  "history:read": "scopeHistoryRead",
  "history:write": "scopeHistoryWrite",
};

export default function OAuthConsent({ clientName, scopes, request }: Props) {
  const t = useTranslations("oauth");
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const approve = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await sb.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) {
        setError(t("loginFirst"));
        return;
      }
      const res = await fetch("/api/oauth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          client_id: request.client_id,
          redirect_uri: request.redirect_uri,
          scope: request.scope,
          state: request.state,
          code_challenge: request.code_challenge,
          code_challenge_method: request.code_challenge_method,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirect) {
        setError(body.error_description || body.error || t("genericError"));
        return;
      }
      window.location.href = body.redirect;
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }, [request, t]);

  const deny = useCallback(() => {
    const back = new URL(request.redirect_uri);
    back.searchParams.set("error", "access_denied");
    if (request.state) back.searchParams.set("state", request.state);
    window.location.href = back.toString();
  }, [request]);

  return (
    <Card variant="glass" className="!p-6 sm:!p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-accent" aria-hidden>
          <Sun className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-title font-bold text-text-primary">
            {t("title", { client: clientName })}
          </h1>
          <p className="text-caption text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {scopes.map((s) => (
          <li key={s} className="flex items-start gap-2 text-body text-text-secondary">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            {t(SCOPE_KEY[s] ?? "scopeUnknown")}
          </li>
        ))}
      </ul>

      {!user && <p className="text-body text-text-secondary">{t("loginFirst")}</p>}
      <AuthButton onAuthChange={setUser} />

      {user && (
        <div className="flex flex-col gap-2 pt-1">
          <PhaseButton onClick={approve} disabled={busy}>
            {busy ? t("approving") : t("approve", { client: clientName })}
          </PhaseButton>
          <button
            onClick={deny}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-surface-elevated px-4 text-body font-medium text-text-secondary hover:bg-surface-input transition-colors"
          >
            {t("deny")}
          </button>
        </div>
      )}

      {error && <p className="text-caption text-red-500">{error}</p>}

      <p className="text-caption text-text-faint">{t("revokeNote")}</p>
    </Card>
  );
}
