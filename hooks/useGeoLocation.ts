"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "vitamind:useGps";

export function useGeoLocation() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<"gpsDenied" | "gpsTimeout" | "gpsUnavailable" | "gpsGenericError" | "gpsNotSupported" | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("gpsNotSupported");
      return;
    }
    setLoading(true);
    setSlow(false);
    setError(null);

    // If permission was already granted, show the hint faster (1s vs 4s)
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (slowTimer.current) clearTimeout(slowTimer.current);
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setLoading(false);
        setSlow(false);
        setError(null);
        setPermissionDenied(false);
      },
      (err) => {
        if (slowTimer.current) clearTimeout(slowTimer.current);
        setLoading(false);
        setSlow(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError("gpsDenied");
        } else if (err.code === err.TIMEOUT) {
          setError("gpsTimeout");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("gpsUnavailable");
        } else {
          setError("gpsGenericError");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 600000,
      },
    );
  }, []);

  const enableGps = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, "true");
    } catch {
      // localStorage unavailable
    }
    requestLocation();
  }, [requestLocation]);

  const disableGps = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, "false");
    } catch {
      // localStorage unavailable
    }
    setLat(null);
    setLon(null);
    setError(null);
    setPermissionDenied(false);
  }, []);

  // On mount: auto-request if previously enabled
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) === "true") {
        requestLocation();
      }
    } catch {
      // localStorage unavailable
    }
  }, [requestLocation]);

  return { lat, lon, loading, slow, error, permissionDenied, requestLocation, enableGps, disableGps };
}
