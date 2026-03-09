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

  const btnStyle: React.CSSProperties = {
    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 10, fontFamily: "'DM Sans',sans-serif",
  };

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          {user.email}
        </span>
        <button onClick={handleLogout} style={{ ...btnStyle, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
          {t("logout")}
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        style={{ ...btnStyle, background: "rgba(255,213,79,0.08)", color: "rgba(255,213,79,0.6)" }}
        title={t("loginHint")}
      >
        {t("login")}
      </button>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", color: "#e0e0e0",
    fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", width: "100%",
  };

  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "rgba(255,213,79,0.03)", border: "1px solid rgba(255,213,79,0.08)",
      maxWidth: 280,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#FFD54F" }}>
          {mode === "login" ? t("login") : mode === "signup" ? t("signup") : t("resendConfirmation")}
        </span>
        <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: "transparent", color: "rgba(255,255,255,0.3)", padding: "2px 6px" }}>
          &#x2715;
        </button>
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8, lineHeight: 1.4 }}>
        {t("syncHint")}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
        {mode !== "resend" && (
          <input type="password" placeholder={t("password")} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required minLength={6} />
        )}
        {error && <div style={{ fontSize: 9, color: "#ef5350" }}>{error}</div>}
        {message && <div style={{ fontSize: 9, color: "#66bb6a" }}>{message}</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit" disabled={loading} style={{ ...btnStyle, flex: 1, background: "rgba(255,213,79,0.15)", color: "#FFD54F", fontWeight: 600 }}>
            {loading ? "..." : mode === "login" ? t("enter") : mode === "signup" ? t("register") : t("resend")}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {mode !== "resend" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}
              style={{ ...btnStyle, background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 9, textAlign: "center" }}
            >
              {mode === "login" ? t("noAccount") : t("hasAccount")}
            </button>
          )}
          {mode === "resend" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setMessage(""); }}
              style={{ ...btnStyle, background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 9, textAlign: "center" }}
            >
              {t("backToLogin")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
