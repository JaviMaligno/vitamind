"use client";

import { AppProvider, useApp } from "@/context/AppProvider";
import { ThemeProvider } from "@/context/ThemeProvider";
import InstallProvider from "@/context/InstallProvider";
import SolarBackground from "@/components/SolarBackground";
import BottomTabBar from "@/components/BottomTabBar";
import SwipeNav from "@/components/SwipeNav";
import LanguageSelector from "@/components/LanguageSelector";
import AuthButton from "@/components/AuthButton";
import ThemeToggle from "@/components/ThemeToggle";
import InstallBanner from "@/components/InstallBanner";
import InstallHelpButton from "@/components/InstallHelpButton";
import UpdateNotice from "@/components/UpdateNotice";
import PushLocaleSync from "@/components/PushLocaleSync";
import { useTranslations } from "next-intl";

function TopBar() {
  const { onAuthChange } = useApp();
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-[1280px] mb-4 px-4 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {/* Darker amber in light themes (dawn/day/dusk) so the logo keeps
              contrast on the warm pink/coral and bright page tints; brighter
              amber in dark (night) so it reads on navy.
              `truncate` is load-bearing: the action cluster is shrink-0, so a
              nowrap logo with the flex default (min-width:auto) refused to
              shrink and spilled *underneath* the icons. overflow-hidden drops
              the automatic minimum to 0, so it ellipsises instead of colliding. */}
          <span className="truncate text-[22px] sm:text-[30px] font-extrabold tracking-tight font-[Playfair_Display,serif] bg-gradient-to-br from-amber-600 to-amber-800 dark:from-amber-400 dark:to-amber-600 bg-clip-text text-transparent [text-shadow:0_1px_2px_rgba(0,0,0,0.12)]">
            {t("app.title")}
          </span>
          {/* Subtitle is noise on the crowded mobile header — desktop only. */}
          <span className="hidden md:inline text-[13px] text-text-muted font-medium truncate">
            {t("app.subtitle")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <InstallHelpButton />
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
        <InstallProvider>
          <SolarBackground>
            <TopBar />
            <SwipeNav>{children}</SwipeNav>
            <div className="mx-auto max-w-[960px] px-4 mt-6 mb-2 text-center text-[10px] text-text-faint">
              <a href="https://javieraguilar.ai" target="_blank" rel="noopener" className="underline hover:text-text-secondary">
                {t("app.builtBy")}
              </a>
            </div>
            <BottomTabBar />
            <InstallBanner />
            <UpdateNotice />
            <PushLocaleSync />
          </SolarBackground>
        </InstallProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
