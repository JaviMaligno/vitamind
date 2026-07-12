# Rediseño visual/UX de VitaminD — Spec de diseño

**Fecha:** 2026-07-12
**Estado:** aprobado en brainstorm, pendiente de plan de implementación.
**Entradas:** auditoría baseline `docs/superpowers/audits/2026-07-12-ui-audit.md`; mockups del brainstorm en `.superpowers/brainstorm/50681-1783875444/content/` (direcciones estéticas, tema día/noche, Explore científico).

## 1. Objetivo

Elevar la app de "funcional pero de juguete" a "producto de verdad" mediante un **sistema de diseño** nuevo, no parches por página. La auditoría concluyó que el problema es de sistema: no hay escala tipográfica (jerarquía por opacidad), ni sistema de componentes, ni lenguaje de marca, ni layout que aproveche el espacio. Este spec define ese sistema y la estrategia para desplegarlo.

**No es** un rediseño de producto: el propósito, la lógica de cálculo solar/vitamina D, las rutas y la estructura SEO no cambian. Es un rediseño visual + de arquitectura de UI.

## 2. Decisiones tomadas en el brainstorm

1. **Ambición:** listón estético "producto de verdad", construido con método de sistema riguroso, conservando los componentes funcionales que ya sirven (revestidos, no reescritos).
2. **Dirección estética: "Clima vibrante" (C).** Gradientes ricos, tarjetas glassy, datos grandes de protagonistas. Transmite energía/actualidad.
3. **Tema: gradiente solar dinámico.** El fondo refleja el estado solar real del lugar (no el reloj), sustituyendo el toggle día/noche binario. **Con override manual** persistido (auto por defecto; el usuario puede forzar un tema).
4. **Lo científico (Explore/visualizaciones)** vive en "ventanas al cielo" (tarjetas glassy de alto contraste) sobre el gradiente; el gradiente es solo ambiente.
5. **Rollout:** PR1 = sistema + página piloto; luego 1 PR por página. Piloto = **página de ciudad SEO**.
6. **Iconografía:** set SVG abierto (Lucide/Phosphor) + 2-3 glifos solares propios. Fuera los emojis como iconografía estructural.

## 3. El sistema de diseño

### 3.1 Motor de gradiente solar

Una función pura que, dado el **estado solar**, devuelve el token de gradiente de fondo.

- **Entrada:** elevación solar actual (o fase del ciclo) derivada de `lib/solar.ts` a partir de lat/lon + fecha + hora. `lib/solar.ts` ya expone la geometría necesaria (elevación, amanecer, atardecer); el motor la consume, no la recalcula.
- **Fases (v1, discretas con interpolación de bordes):** `noche` (sol bajo el horizonte), `amanecer`/`atardecer` (sol ≈ -6°…+12°), `día` (sol alto). Cada fase → un gradiente definido en tokens.
- **Ajuste al ciclo real:** como amanecer/atardecer varían con estación y latitud, la fase se calcula con la posición solar real de la ciudad, no con horas fijas. En invierno al norte el fondo pasa más tiempo en crepúsculo/noche — refuerza el mensaje "aquí hay poco sol útil".
- **Contexto estático vs cliente:**
  - **App (client)** — Mi Día, Explore, Perfil: gradiente dinámico por la hora real.
  - **Páginas SEO estáticas** — city page e índice: se sirven server-side sin depender de JS. Usan un gradiente **representativo fijo** (día) en el HTML servido; opcionalmente el cliente lo "hidrata" al estado solar real tras cargar. La legibilidad no puede depender del JS.
- **Contraste:** el texto **nunca** va suelto sobre el gradiente. Todo contenido legible vive en una superficie (§3.2). Los pocos textos sobre gradiente (etiquetas de ambiente) van en blanco con peso alto y sombra, validados ≥4.5:1 contra el punto más claro del gradiente.

### 3.2 Superficies

Dos superficies canónicas sobre el gradiente:
- **Glass clara** — contenido general (veredictos, tarjetas de datos, formularios). Fondo claro con opacidad **suficiente para garantizar AA** del texto encima (no un glass tan translúcido que el gradiente se filtre y baje el contraste). Definir opacidad mínima como token, no ad hoc.
- **Ventana oscura ("al cielo")** — visualizaciones científicas (curva diaria, heatmap, mapa). Superficie oscura (navy) de alto contraste donde los datos (curva ámbar, ejes) se leen perfecto. Es el hogar de lo "friki", enmarcado.

Ambas con radio, padding, borde y sombra tokenizados (un solo componente Card, §3.4).

### 3.3 Color semántico

Fin del "todo ámbar en 4 intensidades". Paleta con significado:
- **Verde** = síntesis posible / condiciones favorables.
- **Ámbar/naranja** = sol, energía UV, momento de suplementar; es también el color de marca (el sol).
- **Tonos de estado** = ventana cerrada, imposible, etc. (grises/azules fríos para "invierno/sin sol").
- El acento se define como **escala fija de tints con semántica** (activo/hover/seleccionado), no opacidades sueltas.

### 3.4 Tipografía

**Raíz del problema actual:** jerarquía por opacidad. **Se sustituye por escala real de tamaño + peso.**
- **Display:** Playfair Display (ya cargada en `layout.tsx`, hoy sin cablear porque `globals.css` no define tokens de fuente en `@theme`). Se cablea para titulares (h1/h2, veredicto).
- **Cuerpo/UI:** DM Sans.
- **Fuera la monospace** de las cifras de resultado ("9 min", pico solar, fechas) — se pasan a la display/sans con peso alto. La mono se reserva, si acaso, a micro-labels de eje.
- **Escala definida como tokens** (p. ej. display-xl / display-l / title / body / caption) con tamaño y peso propios. Suelo de cuerpo **≥12px**; nada de 7-11px estructural. Los títulos de sección dejan de usar `text-faint` (jerarquía invertida actual).

### 3.5 Componentes base (contenido del PR1)

- **Card** — variantes glass-clara y ventana-oscura; radio/padding/borde/sombra tokenizados.
- **Botón** — primario y secundario canónicos, un solo tratamiento; tap-target ≥44px real con tipografía proporcional.
- **Badge de veredicto** — la pieza focal de la city page: "☀️ Sí · marzo–octubre" en color semántico, tamaño grande. Sustituye el veredicto-párrafo indistinguible de hoy.
- **Tabs/pills glassy** — para Explore (curva/mapa/latitud×año) y togglers.
- **Chips** — exposición de piel, objetivo, favoritos; estado activo con el tint semántico único.
- **Iconos** — componente que envuelve el set SVG (Lucide/Phosphor) + glifos solares propios; reemplaza emojis estructurales.
- **Enlaces** — un tratamiento único (color de acento + foco visible), fin del "punteado vs sólido vs sin color".

### 3.6 Layout

- **Mobile-first** (sigue siendo PWA con bottom tab bar).
- **Grid de 2 columnas en desktop** (`lg:`) para dejar de desperdiciar el 40-50% del ancho. Contenido que hoy se apila (hero+forecast+calendario; viz+estimate+controles) se reparte.
- Tap-targets ≥44px universales.

### 3.7 Override de tema

`auto` (gradiente solar dinámico) por defecto. El usuario puede **forzar** un tema (p. ej. oscuro/noche fijo) desde el control existente; se persiste en `localStorage` reutilizando la key actual `vitamind:theme`. El override no hace daño y cubre a quien prefiera oscuro fijo.

## 4. Arreglos de sistema arrastrados de la auditoría

Se integran al pasar por cada página (no son trabajo aparte):
- **Contraste:** prohibir modificadores de opacidad sobre texto de color (`text-accent/50·/70`, `opacity-60` sueltos); contenido sobre superficies opacas validadas AA.
- **i18n:** traducir `HistoryCalendar` (DAY/MONTH hoy hardcoded en español) y los meses del heatmap (`GlobalHeatmap`) vía `useTranslations`/`Intl`.
- **SEO/Learn:** Learn pasa de `"use client"` con acordeón que oculta el texto a **contenido server-rendered** (respuestas en el HTML servido, indexables y con Ctrl-F/deep-link) + índice/TOC reutilizando las anclas existentes. La city page mantiene su contenido estático indexable; se deshace el "párrafo entero como enlace".
- **Tap-targets:** 44px en todos los controles.

## 5. Reutilización

Se **conservan y revisten** (nueva piel, misma lógica): `CityYearStrip`, `ForecastRow`, `HistoryCalendar`, `DailyCurve`, `GlobalHeatmap`, `CitySearch`, `NotificationToggle`. No se reescribe su cálculo; se re-tokenizan sus colores/tipografía y se envuelven en las nuevas superficies. El year-strip gana una mini-leyenda de valores (0h–10h+).

## 6. Estrategia de rollout

- **PR1 — Sistema + piloto (city page):** tokens (color semántico, superficies, escala tipográfica con Playfair/DM Sans cableadas en `@theme`), motor de gradiente solar, componentes base (Card, Botón, Badge de veredicto, Tabs, Chips, Iconos, Enlace), override de tema; y aplicarlo entero a la **página de ciudad** como piloto que ejercita todo el sistema.
- **PRs siguientes — 1 por página:** Mi Día → Explore → Perfil → Learn → índice de ciudades (orden ajustable). Cada uno desplegable y revisable por separado, integrando sus arreglos de auditoría.
- **Baseline:** tag en `master` antes de tocar código del rediseño, para regresión reproducible (playbook del usuario).

## 7. Restricciones y no-goals

- **No tocar** la lógica de `lib/solar.ts` / `lib/vitd.ts` / cálculos (el motor de gradiente los consume, no los altera).
- **No cambiar** rutas, estructura de URLs ni el schema SEO (FAQPage/CollectionPage) más allá de mejorar la indexabilidad de Learn.
- **No romper** la funcionalidad existente (push, favoritos, búsqueda, i18n de 6 idiomas, PWA/service worker).
- **Anti-scope-creep:** cada PR hace su página y su parte del sistema, nada más.

## 8. Criterios de éxito

- Jerarquía visible sin depender de opacidad (title/body/caption distinguibles por tamaño/peso).
- Todo texto ≥12px estructural; AA cumplido en todas las superficies (validado, no asumido).
- Un solo sistema de componentes usado en todas las páginas (no 4 estilos de card, 4 ámbares).
- La city page piloto se percibe como "producto de verdad" (juicio del usuario).
- Sin regresiones funcionales ni de SEO; Learn ahora indexable.
- Móvil impecable (validación en viewport real, pendiente en la auditoría).

## 9. Riesgos y mitigaciones

- **Contraste sobre gradiente dinámico** → el texto solo sobre superficies opacas validadas; tokens de opacidad mínima; no confiar en glass translúcido para legibilidad.
- **Rendimiento del gradiente** (repintados) → gradiente CSS estático por fase, transición suave entre fases; no animación continua costosa.
- **SEO en páginas estáticas** → el gradiente y el contenido se sirven en HTML sin depender de JS; la hidratación dinámica es progresiva.
- **Alcance** → sistema + 1 página por PR; baseline tag; two-stage review por PR (spec-compliance + code-quality).
- **Consistencia entre PRs** → el PR1 fija los tokens y componentes; los siguientes solo consumen, no redefinen.
