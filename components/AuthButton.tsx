"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Props {
  onAuthChange: (user: User | null) => void;
}

export default function AuthButton({ onAuthChange }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "resend">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const t = useTranslations("auth");

  const sb = getSupabase();

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user);
      onAuthChange(data.user);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      onAuthChange(u);
    });
    return () => subscription.unsubscribe();
  }, [sb, onAuthChange]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signup") {
      const { data, error: err } = await sb.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else if (data.session) {
        setShowForm(false);
      } else {
        setMessage(t("checkEmail"));
        setMode("resend");
      }
    } else if (mode === "resend") {
      const { error: err } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin } });
      if (err) setError(err.message);
      else setMessage(t("emailResent"));
    } else {
      const { error: err } = await sb.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else setShowForm(false);
    }
    setLoading(false);
  }, [sb, email, password, mode, t]);

  const handleLogout = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
    setShowForm(false);
  }, [sb]);

  // No Supabase configured — don't show anything
  if (!sb) return null;

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-text-muted">
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          className="px-2.5 py-1 rounded-md bg-surface-elevated text-text-muted text-[10px] cursor-pointer border-none"
        >
          {t("logout")}
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-2.5 py-1 rounded-md bg-amber-400/[0.08] text-amber-400/60 text-[10px] cursor-pointer border-none"
        title={t("loginHint")}
      >
        {t("login")}
      </button>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-amber-400/[0.03] border border-amber-400/[0.08] max-w-[280px]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-semibold text-amber-400">
          {mode === "login" ? t("login") : mode === "signup" ? t("signup") : t("resendConfirmation")}
        </span>
        <button
          onClick={() => setShowForm(false)}
          className="px-1.5 py-0.5 rounded-md bg-transparent text-text-muted text-[10px] cursor-pointer border-none"
        >
          &#x2715;
        </button>
      </div>
      <div className="text-[9px] text-text-muted mb-2 leading-relaxed">
        {t("syncHint")}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md bg-surface-input border border-border-default text-text-primary text-[11px] outline-none"
          required
        />
        {mode !== "resend" && (
          <input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md bg-surface-input border border-border-default text-text-primary text-[11px] outline-none"
            required
            minLength={6}
          />
        )}
        {error && <div className="text-[9px] text-red-500">{error}</div>}
        {message && <div className="text-[9px] text-green-500">{message}</div>}
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-2.5 py-1 rounded-md bg-amber-400/15 text-amber-400 text-[10px] font-semibold cursor-pointer border-none"
          >
            {loading ? "..." : mode === "login" ? t("enter") : mode === "signup" ? t("register") : t("resend")}
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {mode !== "resend" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}
              className="px-2.5 py-1 rounded-md bg-transparent text-text-muted text-[9px] text-center cursor-pointer border-none"
            >
              {mode === "login" ? t("noAccount") : t("hasAccount")}
            </button>
          )}
          {mode === "resend" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setMessage(""); }}
              className="px-2.5 py-1 rounded-md bg-transparent text-text-muted text-[9px] text-center cursor-pointer border-none"
            >
              {t("backToLogin")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
