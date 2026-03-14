"use client";

import { AppProvider, useApp } from "@/context/AppProvider";
import BottomTabBar from "@/components/BottomTabBar";
import LanguageSelector from "@/components/LanguageSelector";
import AuthButton from "@/components/AuthButton";
import { useTranslations } from "next-intl";

function TopBar() {
  const { onAuthChange } = useApp();
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-[960px] mb-4 px-3 pt-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[30px] font-extrabold tracking-tight font-[Playfair_Display,serif] bg-gradient-to-br from-amber-400 to-amber-700 bg-clip-text text-transparent">
            {t("app.title")}
          </span>
          <span className="text-[13px] text-white/30 font-medium">
            {t("app.subtitle")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <AuthButton onAuthChange={onAuthChange} />
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a0e27] via-60% to-[#080c20] text-[#e0e0e0] font-[DM_Sans,sans-serif] pb-20">
        <TopBar />
        {children}
        <BottomTabBar />
      </div>
    </AppProvider>
  );
}
