"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useRouter } from "@/i18n/navigation";

/**
 * Password-reset landing. Supabase's reset email links here (redirectTo); on
 * arrival supabase-js detects the recovery token in the URL and opens a
 * short-lived recovery session (PASSWORD_RECOVERY event). We then let the user
 * set a new password via updateUser and send them to the dashboard. If no
 * recovery session appears (expired/invalid link), we say so.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const sb = getSupabase();

  const [password, setPassword] = useState("");
  // null = still checking for the recovery session, true = ready, false = invalid link
  const [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sb) return;
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    sb.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    // If no session materialises shortly, the link is expired/invalid.
    const timer = setTimeout(() => setReady((prev) => prev ?? false), 3000);
    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, [sb]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setError("");
    setLoading(true);
    const { error: err } = await sb.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setMessage(t("passwordUpdated"));
      setTimeout(() => router.push("/dashboard"), 1500);
    }
    setLoading(false);
  }, [sb, password, t, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[440px] items-center justify-center px-4 py-10">
      <div className="w-full rounded-[2rem] border border-glass-border bg-glass backdrop-blur-md p-6 sm:p-8 shadow-lg text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/12 text-accent">
          <KeyRound className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="font-display text-title font-bold text-text-primary">{t("resetTitle")}</h1>

        {ready === false ? (
          <p className="mt-4 text-body text-text-muted leading-relaxed">{t("resetLinkInvalid")}</p>
        ) : ready === null ? (
          <p className="mt-4 text-body text-text-muted animate-pulse">…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            <input
              type="password"
              placeholder={t("newPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className="min-h-[44px] w-full rounded-xl bg-surface-input border border-border-default px-4 text-body text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-sun"
            />
            {error && <p className="text-caption text-red-500">{error}</p>}
            {message && <p className="text-caption text-possible">{message}</p>}
            <button
              type="submit"
              disabled={loading || !!message}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 text-body font-semibold text-surface shadow-lg transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "…" : t("updatePassword")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
