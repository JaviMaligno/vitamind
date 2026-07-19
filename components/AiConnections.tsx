"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, Unplug } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import Card from "@/components/ui/Card";

interface Connection {
  clientId: string;
  clientName: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Profile section: which AI clients hold OAuth access to this account, with a
 * revoke button per client. Renders nothing when logged out or with no
 * connections — the section only exists once there's something to manage.
 */
export default function AiConnections() {
  const t = useTranslations("oauth");
  const locale = useLocale();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Sync wrapper; state changes only inside the async continuation (the
  // set-state-in-effect rule accepts this shape — same as AuthButton).
  const load = useCallback(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth
      .getSession()
      .then(async ({ data }) => {
        const jwt = data.session?.access_token;
        if (!jwt) return;
        const res = await fetch("/api/oauth/connections", { headers: { Authorization: `Bearer ${jwt}` } });
        if (!res.ok) return;
        const body = await res.json();
        setConnections(body.connections ?? []);
      })
      // Leave the section hidden on failure — it's management UI, not core.
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = useCallback(async (clientId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return;
    setBusy(clientId);
    try {
      await fetch(`/api/oauth/connections?client_id=${encodeURIComponent(clientId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (!connections || connections.length === 0) return null;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <Card variant="glass">
      <h3 className="font-display font-bold text-xl sm:text-2xl text-text-primary mb-1">
        {t("connectionsHeading")}
      </h3>
      <p className="text-caption text-text-muted mb-4">{t("connectionsIntro")}</p>
      <ul className="space-y-3">
        {connections.map((c) => (
          <li
            key={c.clientId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3"
          >
            <Bot className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-body text-text-primary">{c.clientName || t("unknownClient")}</p>
              <p className="text-caption text-text-muted">
                {t("connectedSince", { date: fmtDate(c.createdAt) })}
                {c.lastUsedAt ? ` · ${t("lastUsed", { date: fmtDate(c.lastUsedAt) })}` : ""}
              </p>
            </div>
            <button
              onClick={() => revoke(c.clientId)}
              disabled={busy === c.clientId}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-500/10 px-3 text-caption font-semibold text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" aria-hidden />
              {busy === c.clientId ? t("revoking") : t("revoke")}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
