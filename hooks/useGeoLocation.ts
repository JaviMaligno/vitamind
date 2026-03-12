"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "vitamind:useGps";

export function useGeoLocation() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("gpsNotSupported");
      return;
    }
    setLoading(true);
    setSlow(false);
    setError(null);

    // After 4 seconds of waiting, hint that GPS might be off
    slowTimer.current = setTimeout(() => setSlow(true), 4000);

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
