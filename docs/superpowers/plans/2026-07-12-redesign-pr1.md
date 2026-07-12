# Rediseño VitaminD — PR1: Sistema + página de ciudad (piloto) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir los fundamentos del sistema de diseño (tokens de fuente/tipografía, color semántico, superficies glass, motor de gradiente solar dinámico con override, componentes base) y aplicarlos a la página de ciudad SEO como piloto.

**Architecture:** Los tokens viven en `app/globals.css` (`@theme` + `.dark`). El gradiente de fondo pasa de estático a derivado del estado solar: una función pura `solarPhase()` (testeable) mapea la elevación solar de `lib/solar.ts` a una fase (dawn/day/dusk/night); un componente cliente aplica el gradiente y el tema resuelto; en SSR estático (city page) se sirve una fase fija `day` y el cliente la hidrata. Los componentes base son piezas presentacionales reutilizables. La city page se reconstruye con ellos, conservando su lógica y su HTML indexable.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4 (`@theme`), Vitest (funciones puras), verificación visual/funcional manual en navegador (§9 del spec).

**Spec:** `docs/superpowers/specs/2026-07-12-redesign-design.md`. **Auditoría:** `docs/superpowers/audits/2026-07-12-ui-audit.md`.

**Ámbito:** SOLO PR1. Mi Día, Explore, Perfil, Learn e índice NO se tocan aquí (van en PRs siguientes). Los componentes se crean pero solo se consumen en la city page en este PR.

---

## Estructura de archivos

**Crear:**
- `lib/solar-phase.ts` — función pura `solarPhase()` + tokens de fase (lógica, sin React).
- `lib/__tests__/solar-phase.test.ts` — tests de la función pura.
- `hooks/useSolarPhase.ts` — hook cliente: fase actual desde lat/lon/now.
- `components/SolarBackground.tsx` — aplica gradiente de fase + resuelve tema; envuelve el contenido.
- `components/ui/Card.tsx` — superficie glass-clara / ventana-oscura.
- `components/ui/Button.tsx` — primario/secundario.
- `components/ui/VerdictBadge.tsx` — badge de veredicto semántico.
- `components/ui/Pills.tsx` — tabs/pills glassy.
- `components/ui/Chip.tsx` — chip seleccionable.
- `components/ui/Icon.tsx` — wrapper de iconos (lucide-react) + glifos solares propios.
- `components/ui/A.tsx` — enlace con tratamiento único (color acento + foco).

**Modificar:**
- `app/globals.css` — tokens de fuente, escala tipográfica, color semántico, superficies, fases de gradiente.
- `context/ThemeProvider.tsx` — modo `auto` (solar) además de light/dark; expone la fase.
- `components/AppShell.tsx` — sustituir el gradiente estático por `SolarBackground`; cablear `font-sans` token.
- `components/ThemeToggle.tsx` — ciclo auto → light → dark.
- `app/[locale]/[cityPrefix]/[city]/page.tsx` — reconstruir con los componentes nuevos.
- `components/CityYearStrip.tsx` — leyenda de valores + tokens.
- `package.json` — dependencia `lucide-react`.

---

## Fase 0 — Baseline y arranque

### Task 0: Tag de baseline y captura de referencia

**Files:** ninguno (git + navegador).

- [ ] **Step 1: Tag baseline en master**

Run:
```bash
cd vitamind && git tag redesign-baseline && git rev-parse --short HEAD
```
Expected: imprime el hash; el tag `redesign-baseline` permite volver para comparar regresiones.

- [ ] **Step 2: Arrancar dev y capturar la city page actual**

Run: `npm run dev` (background) y abrir `http://localhost:3000/en/vitamin-d/london`.
Anotar como baseline funcional: el veredicto ("April to September"), la ventana exacta ("March 24 – September 27"), las líneas de estaciones (June ~8 min), el año-strip, y que el botón "🔔 Notify me" cambia a estado suscrito al pulsar. Guardar captura. Estos valores NO deben cambiar tras el rediseño (§9: los cálculos no se tocan).

- [ ] **Step 3: Crear rama de trabajo**

Run:
```bash
git switch -c feat/redesign-pr1
```
Expected: rama creada.

---

## Fase 1 — Tokens de fundamento (CSS)

### Task 1: Tokens de fuente y escala tipográfica

**Files:**
- Modify: `app/globals.css:3` (dentro de `@theme`)

- [ ] **Step 1: Añadir tokens de fuente y de escala al `@theme`**

En `app/globals.css`, dentro del bloque `@theme { ... }` (tras la línea `@theme {`), añadir:

```css
  /* Fuentes (ya cargadas por CDN en layout.tsx; aquí se cablean como tokens
     para poder usar font-display / font-sans / font-mono en Tailwind). */
  --font-display: "Playfair Display", Georgia, serif;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Escala tipográfica por tamaño/peso (sustituye la jerarquía por opacidad).
     Suelo de cuerpo 14px; nada estructural por debajo. */
  --text-display: 2.25rem;      --text-display--line-height: 1.1;
  --text-title: 1.375rem;       --text-title--line-height: 1.25;
  --text-heading: 1.0625rem;    --text-heading--line-height: 1.3;
  --text-body: 0.9375rem;       --text-body--line-height: 1.5;
  --text-caption: 0.8125rem;    --text-caption--line-height: 1.4;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build` (o mirar el dev server sin errores de CSS).
Expected: build OK; las utilidades `font-display`, `text-display`, etc. quedan disponibles.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): font + type-scale tokens in @theme"
```

### Task 2: Tokens de color semántico y superficies

**Files:**
- Modify: `app/globals.css` (`@theme` y `.dark`)

- [ ] **Step 1: Añadir color semántico y superficies al `@theme` (tema claro)**

En `app/globals.css`, dentro de `@theme { ... }`, añadir tras los tokens de color existentes:

```css
  /* Color semántico */
  --color-possible: #15803d;            /* verde: síntesis posible */
  --color-possible-surface: #dcfce7;
  --color-possible-border: #86efac;
  --color-sun: #ea580c;                 /* naranja: sol / UV / marca */
  --color-sun-strong: #c2410c;
  --color-winter: #64748b;              /* frío: sin sol / invierno */

  /* Superficies del sistema glass */
  --color-glass: rgba(255, 255, 255, 0.86);      /* tarjeta clara sobre gradiente */
  --color-glass-border: rgba(255, 255, 255, 0.6);
  --color-window: #0e1330;                        /* ventana oscura de datos */
  --color-window-border: rgba(255, 255, 255, 0.14);
  --color-on-window: #f4f1ff;                     /* texto sobre ventana */
  --color-on-window-faint: rgba(255, 255, 255, 0.55);
```

- [ ] **Step 2: Añadir overrides en `.dark`**

En `app/globals.css`, dentro de `.dark { ... }`, añadir:

```css
  --color-possible: #4ade80;
  --color-possible-surface: rgba(74, 222, 128, 0.14);
  --color-possible-border: rgba(74, 222, 128, 0.4);
  --color-sun: #fb923c;
  --color-sun-strong: #fdba74;
  --color-winter: #94a3b8;
  --color-glass: rgba(18, 22, 48, 0.72);
  --color-glass-border: rgba(255, 255, 255, 0.12);
  /* window/on-window son iguales en ambos temas (siempre oscura) */
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run build`.
Expected: OK.
```bash
git add app/globals.css
git commit -m "feat(design): semantic colour + glass surface tokens"
```

### Task 3: Tokens de gradiente por fase solar

**Files:**
- Modify: `app/globals.css` (`@theme` y `.dark`)

- [ ] **Step 1: Definir los cuatro gradientes de fase en `@theme`**

En `app/globals.css`, dentro de `@theme`, añadir:

```css
  /* Gradientes de fondo por fase solar (dirección "clima vibrante"). */
  --grad-dawn: linear-gradient(165deg, #ffb07a 0%, #ff7a9c 55%, #c9457e 100%);
  --grad-day: linear-gradient(165deg, #ffc637 0%, #ff8f3f 55%, #ff6b57 100%);
  --grad-dusk: linear-gradient(165deg, #ff7a45 0%, #e0457e 55%, #7a3a9e 100%);
  --grad-night: radial-gradient(120% 90% at 75% -10%, #3a2f6b 0%, #141a3a 50%, #0a0e24 100%);
```

- [ ] **Step 2: Verificar y commit**

Run: `npm run build`.
Expected: OK.
```bash
git add app/globals.css
git commit -m "feat(design): solar-phase gradient tokens"
```

---

## Fase 2 — Motor de gradiente solar

### Task 4: Función pura `solarPhase()` (TDD)

**Files:**
- Create: `lib/solar-phase.ts`
- Test: `lib/__tests__/solar-phase.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/solar-phase.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { solarPhase } from "../solar-phase";

describe("solarPhase", () => {
  it("noche cuando el sol está bien bajo el horizonte", () => {
    expect(solarPhase(-20, true)).toBe("night");
    expect(solarPhase(-20, false)).toBe("night");
  });
  it("día cuando el sol está alto", () => {
    expect(solarPhase(30, true)).toBe("day");
    expect(solarPhase(9, false)).toBe("day");
  });
  it("amanecer: sol bajo y subiendo", () => {
    expect(solarPhase(0, true)).toBe("dawn");
    expect(solarPhase(5, true)).toBe("dawn");
  });
  it("atardecer: sol bajo y bajando", () => {
    expect(solarPhase(0, false)).toBe("dusk");
    expect(solarPhase(5, false)).toBe("dusk");
  });
  it("umbral de noche en -6°", () => {
    expect(solarPhase(-6.1, true)).toBe("night");
    expect(solarPhase(-5.9, true)).toBe("dawn");
  });
});
```

- [ ] **Step 2: Ejecutar el test para verlo fallar**

Run: `npx vitest run lib/__tests__/solar-phase.test.ts`
Expected: FAIL — "Cannot find module '../solar-phase'".

- [ ] **Step 3: Implementar `lib/solar-phase.ts`**

```ts
/** Fase solar del cielo, para elegir el gradiente de fondo. */
export type SolarPhase = "night" | "dawn" | "day" | "dusk";

/**
 * Mapea la elevación solar (grados) y si el sol sube o baja a una fase.
 * <-6° = noche; -6°..+8° = crepúsculo (dawn si sube, dusk si baja); >8° = día.
 */
export function solarPhase(elevationDeg: number, rising: boolean): SolarPhase {
  if (elevationDeg < -6) return "night";
  if (elevationDeg > 8) return "day";
  return rising ? "dawn" : "dusk";
}

/** Mapea una fase a los tokens CSS de gradiente y al tema resuelto que le pega. */
export const PHASE_STYLE: Record<SolarPhase, { grad: string; theme: "light" | "dark" }> = {
  dawn: { grad: "var(--grad-dawn)", theme: "light" },
  day: { grad: "var(--grad-day)", theme: "light" },
  dusk: { grad: "var(--grad-dusk)", theme: "dark" },
  night: { grad: "var(--grad-night)", theme: "dark" },
};
```

- [ ] **Step 4: Ejecutar el test para verlo pasar**

Run: `npx vitest run lib/__tests__/solar-phase.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/solar-phase.ts lib/__tests__/solar-phase.test.ts
git commit -m "feat(design): pure solarPhase() with tests"
```

### Task 5: Hook `useSolarPhase`

**Files:**
- Create: `hooks/useSolarPhase.ts`

- [ ] **Step 1: Implementar el hook**

`lib/solar.ts` exporta `solarElev(lat, lon, doy, utcH)` y `dayOfYear(d)`. El hook computa la elevación ahora y hace 10 min antes para saber si sube.

Crear `hooks/useSolarPhase.ts`:

```ts
"use client";
import { useEffect, useState } from "react";
import { solarElev, dayOfYear } from "@/lib/solar";
import { solarPhase, type SolarPhase } from "@/lib/solar-phase";

/** Fase solar actual para una ubicación. `null` hasta el primer cálculo en cliente
 *  (en servidor no se llama; el fallback de fase lo pone quien lo consuma). */
export function useSolarPhase(lat: number, lon: number): SolarPhase | null {
  const [phase, setPhase] = useState<SolarPhase | null>(null);
  useEffect(() => {
    function compute() {
      const now = new Date();
      const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
      const doy = dayOfYear(now);
      const elev = solarElev(lat, lon, doy, utcH);
      const elevPrev = solarElev(lat, lon, doy, utcH - 1 / 6); // 10 min antes
      setPhase(solarPhase(elev, elev >= elevPrev));
    }
    compute();
    const id = setInterval(compute, 5 * 60 * 1000); // refresco cada 5 min
    return () => clearInterval(id);
  }, [lat, lon]);
  return phase;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSolarPhase.ts
git commit -m "feat(design): useSolarPhase client hook"
```

### Task 6: `ThemeProvider` con modo `auto` solar

**Files:**
- Modify: `context/ThemeProvider.tsx`

- [ ] **Step 1: Añadir el modo `auto` y exponer una fase manual**

El tipo `Theme` pasa a `"auto" | "light" | "dark"` (se elimina `"system"`; `auto` cubre ese caso vía la fase). Reemplazar el contenido de `context/ThemeProvider.tsx` por:

```tsx
"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { SolarPhase } from "@/lib/solar-phase";

type Theme = "auto" | "light" | "dark";

interface ThemeContextValue {
  theme: Theme;                 // preferencia del usuario
  resolved: "light" | "dark";   // tema efectivo aplicado a <html>
  setTheme: (t: Theme) => void;
  cycle: () => void;            // auto -> light -> dark -> auto
  /** En modo auto, el fondo usa esta fase; null hasta que el cliente la fije. */
  autoPhase: SolarPhase | null;
  setAutoPhase: (p: SolarPhase) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function getStored(): Theme {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem("vitamind:theme");
  return v === "light" || v === "dark" ? v : "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStored());
  const [autoPhase, setAutoPhase] = useState<SolarPhase | null>(null);

  // En auto, el tema resuelto lo decide la fase (day/dawn=light, dusk/night=dark).
  const resolved: "light" | "dark" =
    theme === "light" ? "light"
    : theme === "dark" ? "dark"
    : autoPhase === "night" || autoPhase === "dusk" ? "dark" : "light";

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("vitamind:theme", t);
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === "auto" ? "light" : theme === "light" ? "dark" : "auto");
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, cycle, autoPhase, setAutoPhase }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verificar tipos (romperá en ThemeToggle — se arregla en Task 7)**

Run: `node_modules/.bin/tsc --noEmit`
Expected: error solo en `components/ThemeToggle.tsx` (usa `toggle`, ya no existe). Se arregla en la Task 7.

- [ ] **Step 3: Commit**

```bash
git add context/ThemeProvider.tsx
git commit -m "feat(design): ThemeProvider auto (solar) mode + phase"
```

### Task 7: `SolarBackground` y `ThemeToggle`

**Files:**
- Create: `components/SolarBackground.tsx`
- Modify: `components/ThemeToggle.tsx`
- Modify: `components/AppShell.tsx:48`

- [ ] **Step 1: Implementar `SolarBackground`**

Aplica el gradiente de fase (o uno fijo si el override es light/dark) y, en auto, sincroniza la fase con el tema. La ubicación sale de `useApp()` (lat/lon).

Crear `components/SolarBackground.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useApp } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE, type SolarPhase } from "@/lib/solar-phase";

export default function SolarBackground({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { theme, setAutoPhase } = useTheme();
  const livePhase = useSolarPhase(app.lat, app.lon);

  useEffect(() => {
    if (livePhase) setAutoPhase(livePhase);
  }, [livePhase, setAutoPhase]);

  // Fase efectiva para el fondo: en override, una fija representativa.
  const phase: SolarPhase =
    theme === "dark" ? "night" : theme === "light" ? "day" : (livePhase ?? "day");
  const grad = PHASE_STYLE[phase].grad;

  return (
    <div
      className="min-h-screen text-text-primary font-sans pb-20 transition-[background] duration-1000"
      style={{ background: grad }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Usar `SolarBackground` en `AppShell`**

En `components/AppShell.tsx`, importar y sustituir el `<div className="min-h-screen bg-gradient-to-br ...">` (línea 48) por `<SolarBackground>`. Añadir el import y cambiar la apertura/cierre del div:

Import (junto a los demás):
```tsx
import SolarBackground from "@/components/SolarBackground";
```
Reemplazar la línea 48 `<div className="min-h-screen bg-gradient-to-br from-bg-page-from via-bg-page-via via-60% to-bg-page-to text-text-primary font-[DM_Sans,sans-serif] pb-20">` por:
```tsx
          <SolarBackground>
```
y su `</div>` de cierre (línea 60) por `</SolarBackground>`.

- [ ] **Step 3: Actualizar `ThemeToggle` al ciclo auto→light→dark**

Reemplazar `components/ThemeToggle.tsx` por (usa `Icon`, creado en Task 12 — de momento usa glifos inline; en Task 12 se cambia a `Icon`):

```tsx
"use client";
import { useTheme } from "@/context/ThemeProvider";

export default function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const label = theme === "auto" ? "Tema: automático (sol)" : theme === "light" ? "Tema: claro" : "Tema: oscuro";
  const glyph = theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
  return (
    <button
      onClick={cycle}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-glass border border-glass-border text-text-secondary hover:text-text-primary transition-colors"
      aria-label={label}
      title={label}
    >
      <span aria-hidden className="text-sm">{glyph}</span>
    </button>
  );
}
```

- [ ] **Step 4: Verificar en navegador (visual + no-regresión)**

Run: dev server, abrir `http://localhost:3000/en/vitamin-d/london`.
Expected: el fondo es ahora un gradiente cálido (fase día por defecto o la que toque por hora real de Londres). El toggle cicla auto→claro→oscuro y el fondo/tema cambian. El contenido sigue legible (aún sin rediseñar la página). Comprobar que no hay errores en consola.

- [ ] **Step 5: `tsc` y commit**

Run: `node_modules/.bin/tsc --noEmit` → sin errores.
```bash
git add components/SolarBackground.tsx components/ThemeToggle.tsx components/AppShell.tsx
git commit -m "feat(design): solar gradient background + auto/light/dark toggle"
```

**CHECKPOINT 1 — revisión del usuario:** fundamentos (tokens + gradiente solar + override) en marcha. Verificar en navegador antes de seguir con los componentes.

---

## Fase 3 — Componentes base

> Nota de método: los componentes son presentacionales. Cada task fija la **interfaz (props)**, la **estructura** y los **tokens** que usa, con andamiaje inicial. El ajuste fino visual (spacing exacto) se itera en navegador; los criterios de aceptación cierran cada task.

### Task 8: `Card`

**Files:** Create `components/ui/Card.tsx`

- [ ] **Step 1: Implementar**

```tsx
import type { ReactNode } from "react";

type Variant = "glass" | "window";

/** Superficie del sistema. `glass` = tarjeta clara sobre el gradiente (contenido
 *  general). `window` = "ventana al cielo" oscura para visualizaciones de datos. */
export default function Card({
  variant = "glass",
  className = "",
  children,
}: { variant?: Variant; className?: string; children: ReactNode }) {
  const base = "rounded-2xl p-4 shadow-lg";
  const skin =
    variant === "glass"
      ? "bg-glass border border-glass-border backdrop-blur-md text-text-primary"
      : "bg-window border border-window-border text-on-window";
  return <div className={`${base} ${skin} ${className}`}>{children}</div>;
}
```

- [ ] **Step 2: Criterio de aceptación**

Aislado en la city page (Task 14) se verá: glass = tarjeta clara translúcida legible sobre el gradiente (contraste AA del texto), window = superficie oscura para la viz. `tsc` sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Card.tsx
git commit -m "feat(ui): Card (glass / window) surface"
```

### Task 9: `Button`

**Files:** Create `components/ui/Button.tsx`

- [ ] **Step 1: Implementar**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

/** Botón canónico. Tap-target ≥44px. primary = acento sol lleno; secondary = glass. */
export default function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: Variant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-body font-semibold transition-colors cursor-pointer";
  const skin =
    variant === "primary"
      ? "bg-sun text-white hover:bg-sun-strong"
      : "bg-glass border border-glass-border text-text-primary hover:bg-surface-elevated";
  return <button className={`${base} ${skin} ${className}`} {...rest}>{children}</button>;
}
```

- [ ] **Step 2: `tsc` + commit**

```bash
git add components/ui/Button.tsx
git commit -m "feat(ui): Button (primary/secondary)"
```

### Task 10: `VerdictBadge`

**Files:** Create `components/ui/VerdictBadge.tsx`

- [ ] **Step 1: Implementar**

```tsx
type Tone = "possible" | "winter";

/** Pieza focal de la city page: el veredicto sí/no + meses, en color semántico. */
export default function VerdictBadge({
  tone,
  children,
}: { tone: Tone; children: React.ReactNode }) {
  const skin =
    tone === "possible"
      ? "bg-possible-surface text-possible border-possible-border"
      : "bg-surface-elevated text-winter border-border-subtle";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-title font-bold ${skin}`}>
      {children}
    </span>
  );
}
```

Nota: `text-possible`/`bg-possible-surface`/`border-possible-border` provienen de los tokens de la Task 2.

- [ ] **Step 2: `tsc` + commit**

```bash
git add components/ui/VerdictBadge.tsx
git commit -m "feat(ui): VerdictBadge (semantic)"
```

### Task 11: `Pills`, `Chip`, `A`

**Files:** Create `components/ui/Pills.tsx`, `components/ui/Chip.tsx`, `components/ui/A.tsx`

- [ ] **Step 1: `Pills.tsx` (tabs glassy)**

```tsx
export interface PillOption { key: string; label: string }

export default function Pills({
  options, active, onSelect,
}: { options: PillOption[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onSelect(o.key)}
          className={`min-h-[40px] px-4 rounded-full text-caption font-semibold transition-colors ${
            o.key === active
              ? "bg-surface text-sun-strong"
              : "bg-glass border border-glass-border text-text-secondary hover:text-text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `Chip.tsx`**

```tsx
export default function Chip({
  active, onClick, children,
}: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] px-4 rounded-xl text-caption font-medium transition-colors ${
        active
          ? "bg-possible-surface text-possible border border-possible-border"
          : "bg-glass border border-glass-border text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: `A.tsx` (enlace único)**

```tsx
import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

/** Enlace canónico: color de acento sol + foco visible. Envuelve el Link i18n. */
export default function A({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`text-sun-strong underline decoration-2 underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sun ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: `tsc` + commit**

```bash
git add components/ui/Pills.tsx components/ui/Chip.tsx components/ui/A.tsx
git commit -m "feat(ui): Pills, Chip, A (link)"
```

### Task 12: Iconos (`lucide-react` + glifos solares)

**Files:** Add dep; Create `components/ui/Icon.tsx`; Modify `components/ThemeToggle.tsx`

- [ ] **Step 1: Instalar lucide-react**

Run: `npm install lucide-react`
Expected: añadido a `package.json` dependencies.

- [ ] **Step 2: `Icon.tsx` — re-export tipado + glifos propios**

```tsx
export { Bell, BellRing, Sun, Moon, SunMedium, MapPin, ChevronRight, Search } from "lucide-react";

/** Glifo solar propio de marca (arco del sol). 24x24, hereda currentColor. */
export function SunArc({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 18 Q12 2 22 18" strokeLinecap="round" />
      <circle cx="12" cy="8" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

- [ ] **Step 3: Usar `Sun/Moon/SunMedium` en `ThemeToggle`**

En `components/ThemeToggle.tsx`, sustituir el `<span>{glyph}</span>` por el icono según `theme`:
```tsx
import { Sun, Moon, SunMedium } from "@/components/ui/Icon";
// ...
const IconEl = theme === "auto" ? SunMedium : theme === "light" ? Sun : Moon;
// dentro del button:
<IconEl className="w-4 h-4" aria-hidden />
```

- [ ] **Step 4: `tsc`, verificar en navegador, commit**

Run: `node_modules/.bin/tsc --noEmit`; comprobar el toggle en el navegador (icono correcto por modo).
```bash
git add package.json package-lock.json components/ui/Icon.tsx components/ThemeToggle.tsx
git commit -m "feat(ui): Icon (lucide + SunArc) and wire ThemeToggle"
```

**CHECKPOINT 2 — revisión del usuario:** sistema de componentes listo. Aún no aplicado a ninguna página salvo el toggle.

---

## Fase 4 — Aplicar a la página de ciudad (piloto)

### Task 13: Leyenda y tokens en `CityYearStrip`

**Files:** Modify `components/CityYearStrip.tsx`

- [ ] **Step 1: Añadir una mini-leyenda 0h–10h+ y usar tokens de texto**

Añadir un prop `legend?: { low: string; high: string }` y, bajo el SVG, una barra de referencia del gradiente con etiquetas. Sustituir `opacity: 0.6/0.7` por color de token. Reemplazar el bloque `<figcaption>` y añadir, antes de él:

```tsx
      {legend && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 11 }} className="text-text-muted">{legend.low}</span>
          <span style={{ flex: 1, height: 8, borderRadius: 99,
            background: "linear-gradient(90deg, hsl(45,80%,15%), hsl(20,100%,65%))" }} />
          <span style={{ fontSize: 11 }} className="text-text-muted">{legend.high}</span>
        </div>
      )}
```
Y cambiar la firma para aceptar `legend`, y el `<figcaption>` a `className="text-text-muted"` (quitando `opacity: 0.6`). La banda de meses: quitar `opacity: 0.7`, poner `className="text-text-muted"`.

- [ ] **Step 2: Añadir las claves i18n de la leyenda**

En `messages/{es,en,fr,de,ru,lt}.json`, namespace `cityPage`, añadir `yearLegendLow` ("0 h") y `yearLegendHigh` ("10 h+") traducidas.

- [ ] **Step 3: `tsc` + commit**

```bash
git add components/CityYearStrip.tsx messages/*.json
git commit -m "feat(city): year-strip value legend + token colours"
```

### Task 14: Reconstruir la city page con el sistema

**Files:** Modify `app/[locale]/[cityPrefix]/[city]/page.tsx`

> El objetivo de esta task es la piel, NO la lógica: `resolveCity`, `cityYearProfile`, `citySeasonalWindows`, `viableDateBoundaries`, el JSON-LD, los `t(...)` y el `NotificationToggle` se conservan. Se cambian el marcado y las clases para usar `Card`, `VerdictBadge`, `A`, `Button`, la escala tipográfica y los tokens, y se deshace el párrafo-como-enlace.

- [ ] **Step 1: Veredicto focal con `VerdictBadge` + escala tipográfica**

Sustituir el `<h1 className="text-2xl font-bold">` por `className="font-display text-display"` y, bajo él, renderizar el veredicto también como `VerdictBadge` (tono `possible` si `!profile.neverPossible`, `winter` si no). El párrafo de veredicto pasa a `text-body`. La línea `exactWindow` deja de usar `opacity-60`: se envuelve en `<Card variant="glass">` como "Ventana exacta" con `text-heading` para la fecha. Ejemplo de estructura del encabezado:

```tsx
<h1 className="font-display text-display">{t("title", labels)}</h1>
<div className="mt-3">
  <VerdictBadge tone={profile.neverPossible ? "winter" : "possible"}>
    <SunArc className="w-5 h-5" /> {verdict}
  </VerdictBadge>
</div>
{dateRange && (
  <Card variant="glass" className="mt-4 max-w-sm">
    <div className="text-caption text-text-muted uppercase tracking-wide">{t("exactWindowLabel")}</div>
    <div className="text-heading font-semibold mt-1">{dateRange}</div>
  </Card>
)}
```
Añadir la clave `cityPage.exactWindowLabel` ("Ventana exacta" / "Exact window" / …) a los 6 `messages/*.json`. (El texto `exactWindow` actual se reutiliza o se reemplaza por la etiqueta + valor.)

- [ ] **Step 2: Envolver secciones en `Card` y aplicar la escala a los `h2`**

Cada `<section>` (year, seasonal windows, supplement, FAQ, nearby) pasa a `<Card variant="glass">` con separación `mt-6`. Los `<h2 className="text-lg font-semibold">` pasan a `className="font-display text-title"`. El year-strip va en `<Card variant="window">` (ventana oscura) y se le pasa `legend={{ low: t("yearLegendLow"), high: t("yearLegendHigh") }}`.

- [ ] **Step 3: Deshacer el párrafo-como-enlace de suplemento**

Reemplazar el `<Link href="/learn#supplement" className="underline decoration-dotted">{t("supplementBody")}</Link>` (envuelto en `<p>`) por texto normal + un enlace corto debajo:
```tsx
<p className="text-body">{t("supplementBody")}</p>
<A href="/learn#supplement" className="text-caption mt-2 inline-block">{t("supplementMore")}</A>
```
Añadir `cityPage.supplementMore` ("Más sobre suplementos →" / "More about supplements →" / …) a los 6 `messages/*.json`.

- [ ] **Step 4: CTA y notify como `Button`; enlaces con `A`**

El CTA "Calculate my window" pasa a `<Button variant="primary">` envuelto en el `Link` a `/dashboard` (o `Button` con `onClick`→router). Los enlaces de "Nearby cities" y "all cities" pasan a `A`. El `NotificationToggle` se mantiene (su rediseño interno de estilos es menor: alinear sus clases a `Button`, pero su lógica/props NO cambian).

- [ ] **Step 5: Ancho y desktop (§3.6)**

La city page hoy es `max-w-[960px]` en una columna. Subir el contenedor a `max-w-[1100px]` y, en `lg:`, disponer el par "Perfil del año" + "Ventanas estacionales" en un grid de 2 columnas (`lg:grid-cols-2 gap-6`), dejando veredicto/notify/FAQ a ancho completo (la landing sigue siendo legible en una columna en móvil). No forzar 2 columnas en el cuerpo de lectura.

- [ ] **Step 6: Verificar tipos**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores. Si `NotificationToggle` necesita ajuste de clases, hacerlo sin tocar su lógica.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/[cityPrefix]/[city]/page.tsx" messages/*.json
git commit -m "feat(city): rebuild city page on the design system"
```

---

## Fase 5 — Verificación (contrato §9) y cierre

### Task 15: Verificación en navegador (visual + funcional) por el implementador

**Files:** ninguno (navegador). Este es el contrato obligatorio del spec §9.1.

- [ ] **Step 1: Visual — desktop y móvil, varios estados de gradiente**

Abrir `http://localhost:3000/en/vitamin-d/london`. Con el toggle, recorrer auto → claro → oscuro y confirmar: el gradiente cambia; el texto SIEMPRE legible (va sobre `Card`); el veredicto (badge verde) es la pieza más visible; los `h2` en display se distinguen del cuerpo; el year-strip (ventana oscura) tiene leyenda 0h–10h+. Repetir en viewport móvil (DevTools responsive ~390px) confirmando que no hay scroll horizontal y los tap-targets se pinchan bien. Guardar capturas de ambos temas y viewports.

- [ ] **Step 2: Contraste — comprobación AA**

Con el inspector, verificar contraste del texto de cuerpo sobre `Card glass` en fase día (la más clara) y del veredicto: ≥4.5:1 (texto normal) / ≥3:1 (título grande). Anotar ratios.

- [ ] **Step 3: Funcional / contrato frontend↔backend**

En la misma página:
- **Notify:** pulsar el botón; aceptar permiso; confirmar en Network que sale `POST /api/push/subscribe` con el payload íntegro (lat, lon, tz, timezone, skinType, areaFraction, cityName, locale) y que el botón pasa a estado suscrito; pulsar de nuevo → `DELETE`.
- **Cálculos vs baseline (Task 0):** el veredicto ("April–September"), la ventana exacta ("March 24 – September 27") y las estaciones (June ~8 min) coinciden EXACTAMENTE con el baseline — el rediseño no tocó `solar.ts`/`vitd.ts`.
- **Enlaces:** "Nearby cities" y "all cities" navegan (200) a sus rutas localizadas; el CTA va a `/dashboard`.
- **i18n:** repetir en `/es/vitamina-d/londres` y `/lt/...`: textos traducidos, incluidas las claves nuevas (`exactWindowLabel`, `supplementMore`, `yearLegendLow/High`); sin texto hardcodeado.
- **SEO:** ver-fuente confirma que el JSON-LD `FAQPage`, el `<h1>`, el veredicto y el contenido siguen en el HTML servido (indexable); `generateMetadata` (title/description/alternates/hreflang) intacto.

- [ ] **Step 4: Documentar la verificación**

Escribir en el PR (o en `docs/superpowers/audits/2026-07-12-pr1-verification.md`) el checklist marcado + capturas + ratios de contraste + confirmación de que los cálculos coinciden con el baseline. No basta "parece que va".

- [ ] **Step 5: `npm run build` limpio**

Run: `npm run build`
Expected: build de producción sin errores ni warnings nuevos; las 438 rutas de city page se generan.

### Task 16: Handoff a revisión del usuario (§9.2 / §9.3)

- [ ] **Step 1: Desplegar a dev y avisar al usuario**

Desplegar la rama a `vitamind-dev` (ver CLAUDE.md, relink temporal) y pasar al usuario la URL de la city page para su revisión. La city page es el campo de pruebas (§9.3): el usuario valida visual + funcional antes de que se propague el sistema al resto de páginas en PRs siguientes.

- [ ] **Step 2: Recoger feedback y iterar**

Aplicar los cambios que pida el usuario sobre la city page/sistema antes de dar por cerrado el PR1. Solo entonces se planifica el PR2 (Mi Día).

---

## Notas de cierre

- **No-goals recordatorio:** no se toca `lib/solar.ts`/`lib/vitd.ts`, ni rutas, ni el schema SEO (salvo mantener indexabilidad). Los componentes creados solo se consumen en la city page en este PR.
- **Reutilización:** `NotificationToggle` y `CityYearStrip` se conservan (revestidos), no se reescriben.
- **Deuda dejada para PRs siguientes:** los tokens `--color-chart-bar-*` y `--color-text-on-chart` viejos se mantienen hasta que Explore se rediseñe; Learn server-rendered va en su propio PR.
- **Gradiente por ubicación:** `SolarBackground` vive en `AppShell` (global) y usa la ubicación del usuario (`useApp`), no la de la ciudad de la página; en SSR sin ubicación cae a `day`. Afinar el gradiente a la fase de la ciudad concreta de cada city page es una mejora futura (requeriría pasar lat/lon de la página al fondo) — fuera del alcance de PR1.
