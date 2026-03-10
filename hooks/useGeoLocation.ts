"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "vitamind:useGps";

export function useGeoLocation() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("gpsNotSupported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setLoading(false);
        setError(null);
        setPermissionDenied(false);
      },
      (err) => {
        setLoading(false);
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
        timeout: 30000,
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

  return { lat, lon, loading, error, permissionDenied, requestLocation, enableGps, disableGps };
}
