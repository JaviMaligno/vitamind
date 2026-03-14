"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadPreferences } from "@/lib/storage";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const prefs = loadPreferences();
    if (prefs.lastCityId && prefs.skinType) {
      router.replace("/dashboard");
    } else {
      router.replace("/explore");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );
}
