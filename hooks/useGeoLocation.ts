"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "vitamind:useGps";
const GLOBAL_TIMEOUT = 20_000;

export function useGeoLocation() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<"gpsDenied" | "gpsTimeout" | "gpsUnavailable" | "gpsGenericError" | "gpsNotSupported" | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchId = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (slowTimer.current) {
      clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
    if (globalTimer.current) {
      clearTimeout(globalTimer.current);
      globalTimer.current = null;
    }
  }, []);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("gpsNotSupported");
      return;
    }

    // Clean up any previous watcher before starting a new one
    cleanup();

    setLoading(true);
    setSlow(false);
    setError(null);

    // If permission was already granted, show the hint faster (1.5s vs 4s)
    // because the only reason it would be slow is that the device GPS is off
    let hintDelay = 4000;
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        if (perm.state === "granted") hintDelay = 1500;
      }
    } catch {
      // Permissions API not supported — use default delay
    }

    slowTimer.current = setTimeout(() => setSlow(true), hintDelay);

    // Global safety timeout: if no position after 20s, give up
    globalTimer.current = setTimeout(() => {
      cleanup();
      setLoading(false);
      setSlow(false);
      setError("gpsTimeout");
    }, GLOBAL_TIMEOUT);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        cleanup();
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setLoading(false);
        setSlow(false);
        setError(null);
        setPermissionDenied(false);
      },
      (err) => {
        // PERMISSION_DENIED is definitive — stop immediately
        if (err.code === err.PERMISSION_DENIED) {
          cleanup();
          setLoading(false);
          setSlow(false);
          setPermissionDenied(true);
          setError("gpsDenied");
        }
        // TIMEOUT and POSITION_UNAVAILABLE are transient —
        // watchPosition keeps retrying, global timer handles the hard limit
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 600000,
      },
    );
  }, [cleanup]);

  const enableGps = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, "true");
    } catch {
      // localStorage unavailable
    }
    requestLocation();
  }, [requestLocation]);

  const disableGps = useCallback(() => {
    cleanup();
    try {
      localStorage.setItem(LS_KEY, "false");
    } catch {
      // localStorage unavailable
    }
    setLat(null);
    setLon(null);
    setLoading(false);
    setSlow(false);
    setError(null);
    setPermissionDenied(false);
  }, [cleanup]);

  // On mount: auto-request if previously enabled
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) === "true") {
        requestLocation();
      }
    } catch {
      // localStorage unavailable
    }
    return cleanup;
  }, [requestLocation, cleanup]);

  return { lat, lon, loading, slow, error, permissionDenied, requestLocation, enableGps, disableGps };
}
