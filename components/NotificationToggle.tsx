"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  skinType: number;
  areaFraction: number;
  threshold: number;
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

export default function NotificationToggle({ lat, lon, tz, skinType, areaFraction, threshold, cityName }: Props) {
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
          lat, lon, tz, skinType, areaFraction, threshold, cityName,
        }),
      });
      setStatus("on");
    }
  }, [status, lat, lon, tz, skinType, areaFraction, threshold, cityName]);

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
            lat, lon, tz, skinType, areaFraction, threshold, cityName,
          }),
        });
      });
    });
  }, [status, lat, lon, tz, skinType, areaFraction, threshold, cityName]);

  if (status === "loading" || status === "unsupported") return null;

  return (
    <button
      onClick={toggle}
      disabled={status === "denied"}
      title={
        status === "denied"
          ? t("deniedHint")
          : status === "on"
            ? t("disableHint")
            : t("enableHint")
      }
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "none",
        cursor: status === "denied" ? "not-allowed" : "pointer",
        background: status === "on" ? "rgba(255,213,79,0.15)" : status === "denied" ? "rgba(255,60,60,0.08)" : "rgba(255,255,255,0.04)",
        color: status === "on" ? "#FFD54F" : status === "denied" ? "rgba(255,60,60,0.4)" : "rgba(255,255,255,0.35)",
        fontSize: 10,
        fontWeight: status === "on" ? 600 : 400,
        fontFamily: "'DM Sans',sans-serif",
        opacity: status === "denied" ? 0.5 : 1,
      }}
    >
      {status === "on" ? t("on") : status === "denied" ? t("blocked") : t("notify")}
    </button>
  );
}
