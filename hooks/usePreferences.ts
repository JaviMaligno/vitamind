"use client";

import { useState, useCallback, useEffect } from "react";
import { loadPreferences, savePreferences, loadHistory, saveHistory, mergeHistory, loadFavorites, loadCustomLocations, saveCustomLocation } from "@/lib/storage";
import { loadProfile, updateProfile } from "@/lib/profile";
import type { SkinType } from "@/lib/vitd";
import type { City } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function usePreferences() {
  const [skinType, setSkinType] = useState<SkinType>(3);
  const [areaFraction, setAreaFraction] = useState(0.25);
  const [age, setAge] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(45);
  const [targetIU, setTargetIU] = useState(1000);
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Load persisted preferences on mount
  useEffect(() => {
    const prefs = loadPreferences();
    setThreshold(prefs.threshold);
    if (prefs.skinType) setSkinType(prefs.skinType);
    if (prefs.areaFraction) setAreaFraction(prefs.areaFraction);
    if (prefs.age) setAge(prefs.age);
    if (prefs.targetIU !== undefined) setTargetIU(prefs.targetIU);
  }, []);

  // Persist preferences callback (called by page when cityId changes)
  const persistPreferences = useCallback(
    (cityId: string) => {
      savePreferences({ threshold, lastCityId: cityId, skinType, areaFraction, age: age ?? undefined, targetIU });
      if (authUser) {
        updateProfile(authUser.id, { lastCityId: cityId, skinType, areaFraction, age, targetIU });
      }
    },
    [skinType, areaFraction, age, targetIU, authUser],
  );

  // Sync profile from Supabase on auth change
  const handleAuthChange = useCallback(
    async (user: User | null, setFavorites: (f: string[]) => void, setCityId: (id: string) => void, setCustomLocations: (c: City[]) => void) => {
      setAuthUser(user);
      if (user) {
        const { profile } = await loadProfile();
        if (profile) {
          setSkinType(profile.skinType);
          setAreaFraction(profile.areaFraction);
          setAge(profile.age);
          setTargetIU(profile.targetIU);

          // Merge favorites: union of local + remote (prevent data loss)
          const localFavs = loadFavorites();
          const mergedFavs = [...new Set([...localFavs, ...profile.favorites])];
          setFavorites(mergedFavs);

          // Merge custom locations: union of local + remote by ID
          const localCustom = loadCustomLocations();
          const localIds = new Set(localCustom.map(c => c.id));
          const remoteOnly = profile.customLocations.filter(c => !localIds.has(c.id));
          const mergedCustom = [...localCustom, ...remoteOnly];
          setCustomLocations(mergedCustom);
          for (const c of remoteOnly) saveCustomLocation(c);

          if (profile.lastCityId) setCityId(profile.lastCityId);

          // Merge histories: remote wins on conflict
          const localHistory = loadHistory();
          const merged = mergeHistory(localHistory, profile.history);
          saveHistory(merged);
        }
      }
    },
    [],
  );

  return {
    skinType,
    setSkinType,
    areaFraction,
    setAreaFraction,
    age,
    setAge,
    threshold,
    setThreshold,
    targetIU,
    setTargetIU,
    authUser,
    persistPreferences,
    handleAuthChange,
  };
}
