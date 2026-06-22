"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Keeps a push subscription's stored language in sync with the user's chosen
 * locale, on every page load — independent of the /profile page where
 * NotificationToggle lives.
 *
 * Without this, a subscription created with a stale/absent locale (which makes
 * notify fall back to Spanish) was only corrected by visiting /profile. Since a
 * notification tap opens "/", users who never reopened /profile kept getting
 * Spanish push forever. Mounted app-wide in AppShell, this PATCHes the locale
 * whenever an active subscription exists, fixing them on their next visit.
 */
export default function PushLocaleSync() {
  const locale = useLocale();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let cancelled = false;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled || !sub) return;
        return fetch("/api/push/subscribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, locale }),
        });
      })
      .catch(() => { /* best-effort: a failed sync just retries next load */ });

    return () => { cancelled = true; };
  }, [locale]);

  return null;
}
