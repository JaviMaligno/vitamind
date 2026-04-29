"use client";

import { AppProvider, useApp } from "@/context/AppProvider";
import { ThemeProvider } from "@/context/ThemeProvider";
import BottomTabBar from "@/components/BottomTabBar";
import LanguageSelector from "@/components/LanguageSelector";
import AuthButton from "@/components/AuthButton";
import ThemeToggle from "@/components/ThemeToggle";
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
          <span className="text-[13px] text-text-muted font-medium">
            {t("app.subtitle")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSelector />
          <AuthButton onAuthChange={onAuthChange} />
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <ThemeProvider>
      <AppProvider>
        <div className="min-h-screen bg-gradient-to-br from-bg-page-from via-bg-page-via via-60% to-bg-page-to text-text-primary font-[DM_Sans,sans-serif] pb-20">
          <TopBar />
          {children}
          <div className="mx-auto max-w-[960px] px-4 mt-6 mb-2 text-center text-[10px] text-text-faint">
            <a href="https://javieraguilar.ai" target="_blank" rel="noopener" className="underline hover:text-text-secondary">
              {t("app.builtBy")}
            </a>
          </div>
          <BottomTabBar />
        </div>
      </AppProvider>
    </ThemeProvider>
  );
}
