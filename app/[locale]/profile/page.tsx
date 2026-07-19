"use client";

import { useState, useMemo, useId } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useTranslations } from "next-intl";
import { Info, X, BookOpen, ArrowRight, Star, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useApp } from "@/context/AppProvider";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { TARGET_IU_PRESETS, maxSessionIU } from "@/lib/vitd";
import CitySearch from "@/components/CitySearch";
import SkinSelector from "@/components/SkinSelector";
import NotificationToggle from "@/components/NotificationToggle";
import SaveLocationModal from "@/components/SaveLocationModal";
import GpsButton from "@/components/GpsButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Flag from "@/components/ui/Flag";
import ProfileHeroBold from "@/components/ProfileHeroBold";

// Same full-row nav-link treatment as the dashboard's "Learn more" row: glass
// surface, accent-coloured chevron, no underline (a nav row, not inline text,
// so <A> — which is always underlined — doesn't fit here).
const navRowClasses =
  "flex items-center justify-between rounded-2xl bg-glass border border-glass-border backdrop-blur-md px-4 py-3 shadow-lg hover:bg-surface-elevated transition-colors";

const sectionHeading = "font-display font-bold text-xl sm:text-2xl text-text-primary";

interface TipPanelProps {
  open: boolean;
  text: string;
  href: string;
  learnMoreLabel: string;
  onClose: () => void;
}

function TipPanel({ open, text, href, learnMoreLabel, onClose }: TipPanelProps) {
  if (!open) return null;
  return (
    <div className="mt-2 mb-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-caption text-text-muted leading-relaxed">
      <p>{text}</p>
      <Link href={href} className="block mt-1.5 text-sun-strong hover:opacity-80 text-caption" onClick={onClose}>
        {learnMoreLabel} →
      </Link>
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations("config");
  const tc = useTranslations("common");
  const latId = useId();
  const lonId = useId();
  const ts = useTranslations("skin");
  const app = useApp();
  const getCityDisplayName = useCityDisplayName();

  const [savingLocation, setSavingLocation] = useState(false);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const closeTip = () => setOpenTip(null);

  // Seed the empty favorites state with a few well-known cities so a first-time
  // visitor can add one with a single tap instead of hunting in the search box.
  // Mirrors dashboard/page.tsx's popularCities; here the action ADDS a favorite.
  const popularCities = useMemo(() => {
    const ids = ["builtin:madrid", "builtin:londres", "builtin:nueva-york", "builtin:paris", "builtin:tokio", "builtin:sidney"];
    return ids
      .map((id) => app.allCities.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [app.allCities]);

  // Hydration guard: this page renders state hydrated from localStorage
  // (app.lat/lon/skinType/favorites/targetIU/cityName via AppProvider), which
  // can differ between server and first client render → React #418. Render a
  // stable, data-free placeholder until mounted, then swap to the real
  // content. All hooks above still run unconditionally every render; only the
  // returned JSX branches on `mounted`.
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 space-y-6">
        <div className="min-h-[600px]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Bold poster hero (text-only), matching the rest of the redesign. */}
      <ProfileHeroBold eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      {/* Search city */}
      <Card variant="glass">
        <h3 className={`${sectionHeading} mb-3`}>{t("searchCity")}</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <CitySearch
            onSelect={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
          />
          <GpsButton />
          <div className="flex gap-1.5 items-center">
            {/* Bare <span>s before: visible but never announced, so both
                coordinate boxes reached a screen reader unnamed. Same pixels. */}
            <label htmlFor={latId} className="text-caption text-text-faint">{tc("lat")}</label>
            <input
              id={latId}
              value={app.lat}
              onChange={(e) => {
                app.setLat(parseFloat(e.target.value) || 0);
                app.setCityName(`${e.target.value}°`);
                app.setCityFlag("📍");
              }}
              className="w-16 min-h-[44px] px-2 rounded-lg bg-surface-input border border-border-default text-text-primary text-caption font-mono outline-none focus-visible:ring-2 focus-visible:ring-sun"
            />
            <label htmlFor={lonId} className="text-caption text-text-faint">{tc("lon")}</label>
            <input
              id={lonId}
              value={app.lon}
              onChange={(e) => {
                app.setLon(parseFloat(e.target.value) || 0);
                app.setTz(
                  Math.round((parseFloat(e.target.value) || 0) / 15),
                );
              }}
              className="w-16 min-h-[44px] px-2 rounded-lg bg-surface-input border border-border-default text-text-primary text-caption font-mono outline-none focus-visible:ring-2 focus-visible:ring-sun"
            />
          </div>
        </div>
        {/* Actions row */}
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          {!app.isCurrentFav && app.cityName && (
            <Button variant="secondary" onClick={() => app.toggleFav(app.cityId)}>
              {tc("favorite")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setSavingLocation(true)}>
            {tc("saveAs")}
          </Button>
        </div>
        {savingLocation && (
          <div className="mt-3">
            <SaveLocationModal
              lat={app.lat}
              lon={app.lon}
              cityName={app.cityName}
              cityFlag={app.cityFlag}
              onSave={(city) => {
                app.handleSaveLocation(city);
                setSavingLocation(false);
              }}
              onCancel={() => setSavingLocation(false)}
            />
          </div>
        )}
      </Card>

      {/* Favorites */}
      <Card variant="glass">
        <h3 className={`${sectionHeading} mb-3`}>{t("favorites")}</h3>
        {app.favorites.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <Star className="h-5 w-5 shrink-0 text-accent mt-0.5" aria-hidden />
              <p className="text-body text-text-secondary leading-relaxed">{t("favoritesEmpty")}</p>
            </div>
            {popularCities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {popularCities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => app.toggleFav(c.id)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-elevated px-4 text-body font-medium text-text-secondary hover:bg-surface-input hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-accent" aria-hidden />
                    <Flag flag={c.flag} className="text-lg" />
                    {getCityDisplayName(c.id, c.name)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center">
            {app.favorites.map((fid) => {
              const c = app.allCities.find((x) => x.id === fid);
              if (!c) return null;
              const isSel = app.cityId === fid;
              return (
                <div key={fid} className="flex items-center gap-1">
                  <Chip active={isSel} onClick={() => app.selectCity(c)}>
                    <Flag flag={c.flag} className="text-base" /> {getCityDisplayName(c.id, c.name)}
                  </Chip>
                  {app.editingFavs && (
                    <button
                      onClick={() => {
                        app.toggleFav(fid);
                        if (c.source === "custom") app.handleDeleteCustom(fid);
                      }}
                      aria-label={tc("cancel")}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-red-500/10 text-red-400 cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
            <Chip active={app.editingFavs} onClick={() => app.setEditingFavs(!app.editingFavs)}>
              {app.editingFavs ? t("done") : t("edit")}
            </Chip>
          </div>
        )}
      </Card>

      {/* "How you synthesize" pair — balanced 2-col on desktop. */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
      {/* Solar profile */}
      <Card variant="glass">
        <div className="flex items-center gap-2 mb-3">
          <h3 className={`${sectionHeading} flex-1`}>{t("solarProfile")}</h3>
          <button
            onClick={() => setOpenTip(openTip === "skin" ? null : "skin")}
            aria-label={tc("learnMore")}
            className="w-11 h-11 rounded-full bg-surface-elevated text-text-faint hover:text-text-muted inline-flex items-center justify-center transition-colors cursor-pointer"
          ><Info className="h-4 w-4" aria-hidden /></button>
        </div>
        <TipPanel open={openTip === "skin"} text={ts("tipSolarProfile")} href="/learn" learnMoreLabel={tc("learnMore")} onClose={closeTip} />
        <SkinSelector
          skinType={app.skinType}
          areaFraction={app.areaFraction}
          age={app.age}
          onSkinChange={app.setSkinType}
          onAreaChange={app.setAreaFraction}
          onAgeChange={app.setAge}
        />
        <p className="text-caption text-text-faint mt-1.5 leading-relaxed">
          {ts("exposureDefaultHint")}
        </p>
      </Card>

      {/* Target IU */}
      <Card variant="glass">
        <div className="flex items-center gap-2 mb-3">
          <h3 className={`${sectionHeading} flex-1`}>{t("targetIU")}</h3>
          <button
            onClick={() => setOpenTip(openTip === "iu" ? null : "iu")}
            aria-label={tc("learnMore")}
            className="w-11 h-11 rounded-full bg-surface-elevated text-text-faint hover:text-text-muted inline-flex items-center justify-center transition-colors cursor-pointer"
          ><Info className="h-4 w-4" aria-hidden /></button>
        </div>
        <TipPanel open={openTip === "iu"} text={ts("tipTargetIU")} href="/learn#supplement" learnMoreLabel={tc("learnMore")} onClose={closeTip} />
        <div className="flex flex-wrap gap-1.5 items-center">
          {TARGET_IU_PRESETS.map(({ value, labelKey }) => (
            <Chip key={value} active={app.targetIU === value} onClick={() => app.setTargetIU(value)}>
              <span className="font-mono">{value}</span> {ts(labelKey)}
            </Chip>
          ))}
          <div className="flex items-center gap-1.5">
            {/* No caption to associate here — the "IU" beside it is the unit and
                the <h3> is a section heading, so name it directly instead. */}
            <input
              type="number"
              aria-label={t("targetIU")}
              min={100}
              max={10000}
              step={100}
              value={app.targetIU}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 100 && v <= 10000) app.setTargetIU(v);
              }}
              className="w-20 min-h-[44px] px-2 py-1.5 rounded-md bg-surface-input border border-border-default text-text-primary text-[11px] font-mono outline-none text-center"
            />
            <span className="text-caption text-text-muted">IU</span>
          </div>
        </div>
        <p className="text-caption text-text-faint mt-2 leading-relaxed">
          {ts("targetHint", { max: Math.round(maxSessionIU(app.areaFraction, app.age)) })}
        </p>
      </Card>
      </div>

      {/* Notifications */}
      <Card variant="glass">
        <h3 className={`${sectionHeading} mb-3`}>{t("notifications")}</h3>
        <NotificationToggle
          lat={app.lat}
          lon={app.lon}
          tz={app.tz}
          timezone={app.timezone}
          skinType={app.skinType}
          areaFraction={app.areaFraction}
          cityName={app.cityName}
          prominent
        />
      </Card>

      {/* Learn more — moved to the bottom; an educational deep-dive belongs
          after the settings, not ahead of them. */}
      <Link href="/learn" className={navRowClasses}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-text-muted" aria-hidden />
          <span className="text-caption font-medium text-text-secondary">{tc("learnMore")}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-sun-strong" aria-hidden />
      </Link>
    </div>
  );
}
