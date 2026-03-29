"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  skinType: number;
  areaFraction: number;
  cityName: string;
}

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function NotificationToggle({ lat, lon, tz, timezone, skinType, areaFraction, cityName }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const t = useTranslations("notifications");

  // Check permission on mount and when user returns to tab (e.g. after changing browser settings)
  useEffect(() => {
    function checkPermission() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      // If was denied but now default/granted, reset to check subscription
      if (Notification.permission === "default") {
        setStatus((prev) => prev === "denied" ? "off" : prev);
      }
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (Notification.permission !== "denied") {
            setStatus(sub ? "on" : "off");
          }
        });
      });
    }

    checkPermission();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkPermission();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const toggle = useCallback(async () => {
    if (status === "on") {
      // Unsubscribe
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } else {
      // Subscribe
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("VAPID key not configured");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          lat, lon, tz, timezone, skinType, areaFraction, cityName,
        }),
      });
      setStatus("on");
    }
  }, [status, lat, lon, tz, timezone, skinType, areaFraction, cityName]);

  // Update subscription when preferences change
  useEffect(() => {
    if (status !== "on") return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (!sub) return;
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            lat, lon, tz, timezone, skinType, areaFraction, cityName,
          }),
        });
      });
    });
  }, [status, lat, lon, tz, timezone, skinType, areaFraction, cityName]);

  if (status === "loading") {
    return (
      <span className="text-xs text-text-faint italic">{t("loading")}</span>
    );
  }

  if (status === "unsupported") {
    return (
      <span className="text-xs text-text-faint">{t("unsupported")}</span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={status === "denied"}
      className={`min-h-[44px] px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
        status === "on"
          ? "bg-amber-400/15 text-amber-400 font-semibold"
          : status === "denied"
            ? "bg-red-500/[0.08] text-red-400/40 opacity-50 cursor-not-allowed"
            : "bg-surface-elevated text-text-muted hover:bg-surface-input"
      }`}
      title={
        status === "denied"
          ? t("deniedHint")
          : status === "on"
            ? t("disableHint")
            : t("enableHint")
      }
    >
      {status === "on" ? `🔔 ${t("on")}` : status === "denied" ? `🚫 ${t("blocked")}` : `🔕 ${t("notify")}`}
    </button>
  );
}
