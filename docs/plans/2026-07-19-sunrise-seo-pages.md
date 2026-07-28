# Plan futuro: páginas SEO dedicadas de amanecer/atardecer

**Estado: PRIMERA OLA EN PRODUCCIÓN (2026-07-20).** 28 ciudades × 12 meses ×
6 idiomas = 2.016 páginas en `/amanecer/{ciudad}/{mes}` y equivalentes
localizados. Implementación: `lib/sun-routes.ts` (prefijos/slugs/alternates,
con tests) + `app/[locale]/[cityPrefix]/[city]/[month]/page.tsx` (tabla día a
día server-rendered con alba/anochecer, snapshot mensual, bloque de vitamina D,
FAQ JSON-LD, malla interna) + sitemap. **Siguientes olas:** ampliar
`SUNRISE_CITIES` hacia las 73 ciudades cuando Search Console muestre
impresiones en estas; el resto de este documento describe el plan original y
los criterios, que siguen vigentes para la expansión.

## Contexto

En julio de 2026 la app se amplió de "calculadora de vitamina D" a "tu relación
con el sol": panel "El sol hoy" (dashboard, Explorador y páginas de ciudad),
tabla mensual estática de amanecer/atardecer con desplegable día a día
(crepúsculo civil incluido, calculado en cliente), FAQs solares con JSON-LD y
cuatro preguntas nuevas en la Guía (`learn` bloque 4).

Decisión tomada entonces: **no** hornear las ~365 filas diarias en el HTML de
las 438 páginas de ciudad (contenido fino, peso extra, sin valor SEO). La
batalla por las búsquedas tipo "amanecer madrid julio" o "a qué hora se pone el
sol en madrid en octubre" requiere URLs dedicadas, no páginas de ciudad más
gordas. Eso es este plan.

## Qué construir

SEO programático análogo al de las ciudades (`/vitamina-d/madrid`), reusando la
misma maquinaria:

- **Rutas:** `app/[locale]/[sunPrefix]/[city]/[month]/page.tsx` con prefijos
  localizados como los de ciudad (`/amanecer/madrid/julio`,
  `/en/sunrise/madrid/july`, …). Los prefijos y slugs de mes van a un
  equivalente de `lib/city-routes.ts` (nuevo `lib/sun-routes.ts`), con
  `generateStaticParams`, hreflang/canonicals vía `i18n/metadata.ts` y entrada
  en `app/sitemap.ts`. Empezar con un subconjunto de ciudades (las ~45 con más
  tráfico en Search Console), no las 438 × 12 de golpe: 438×12×6 ≈ 31.500
  páginas de golpe huele a spam para Google; crecer por tandas.
- **Contenido por página (todo estático en build, aquí SÍ server-side):**
  - Tabla día a día del mes: alba, amanecer, atardecer, anochecer, duración —
    `dailySunTimes()` de `lib/sun-times.ts` ya lo calcula todo.
  - Resumen del mes: primer/último día, cuánto se gana/pierde de luz en el mes
    (`monthlySunTimes()` + deltas), hora dorada típica.
  - Párrafo de copy única por ciudad-mes (plantillas ICU con variables reales,
    estilo `lib/city-copy.ts`) para esquivar el "thin content": qué cambia ese
    mes en esa ciudad, no texto genérico.
  - Gancho diferencial: bloque "ventana de vitamina D de este mes" enlazando a
    la página de ciudad — es lo que ninguna web de efemérides ofrece.
  - FAQ con JSON-LD (¿a qué hora amanece el día 1 / el día 30?, ¿cuánta luz se
    gana?) y `BreadcrumbList`.
- **Enlazado interno:** desde la tabla mensual de la página de ciudad (cada fila
  de mes → su página amanecer/mes), desde el desplegable día a día, y malla
  entre meses adyacentes + misma página en ciudades cercanas
  (`lib/city-nearby.ts`). Todo estático para que Google lo siga.

## Cuándo activarlo

Revisar Search Console unas semanas después de que la tabla mensual y las FAQ
solares lleven en producción:

- Si hay impresiones crecientes en queries de amanecer/atardecer/hora dorada
  (aunque sea con posición mala), hay demanda alcanzable → construir.
- Si las impresiones solares son ~0, la autoridad del dominio aún no da para
  ese campo de batalla → posponer y reforzar antes el nicho vitamina D.

## Riesgos y notas

- **Thin content / spam programático:** es el riesgo principal. Mitigación:
  tandas pequeñas, copy única por página con datos reales, y no publicar meses
  sin nada que decir (p. ej. ciudades ecuatoriales donde nada cambia — ahí
  mejor una sola página anual por ciudad).
- **Canibalización:** las páginas de ciudad ya posicionan "amanecer {ciudad}"
  débilmente vía FAQ; definir el canonical de la intención "amanecer" hacia las
  páginas nuevas cuando existan.
- **Coste técnico:** bajo. La matemática (`lib/sun-times.ts`), el patrón de
  rutas localizadas, el sitemap y el patrón de copy por plantillas ya existen;
  es sobre todo trabajo de rutas + copy + i18n (6 locales).

---

## Ola 2 (2026-07-28) y qué la justificó

Datos que la motivaron, de Search Console a 28 días frente al baseline de 90 días del
25/7:

| | Baseline (90 d) | Ola 1 viva (28 d) |
|---|---|---|
| Impresiones | 39 | **435** |
| Páginas con datos | 20 | **192** |
| Posición media | 9,5 | 8,8 |

**Nueve de las diez páginas más vistas eran de esta familia**, y la curva de impresiones
se dispara el 26/7. Las consultas son de cola larga y en su mayoría piden **puesta de
sol**, no amanecer: `sunset in paris august`, `what time does it get dark in japan in
august`, `heure coucher soleil 15 aout`, `sunset tokyo october`.

Criterios de selección de la ola 2, sacados de esos datos:

1. **Latitud ≥ 48°.** Cuanto más lejos del ecuador, más difieren de verdad las doce
   tablas mensuales: cada página responde algo distinto en vez de ser casi copia de sus
   hermanas. Por eso las ciudades ecuatoriales (Bangkok, Nairobi, Kuala Lumpur, Lagos)
   siguen deliberadamente fuera.
2. **Destino grande**, que es el perfil de las que ya rinden (Tokio, París, Ámsterdam,
   Londres, Sídney).

Ciudades: Reikiavik, Oslo, Estocolmo, Helsinki, Copenhague, Varsovia, Praga, Viena,
Budapest, Bruselas, Seattle, Vancouver. **12 × 12 meses × 6 idiomas = 864 URLs**
(sitemap 2496 → 3360).

Se eligió una ola corta y no las 45 ciudades restantes porque el cuello no es el
contenido sino el **descubrimiento**: de las 2496 URLs declaradas Google solo conocía
~633. Añadir 3240 de golpe sería echar agua en un vaso lleno.

### CTR: por qué NO se tocó el copy

El CTR es del 0,7 % (3 clics / 435 impresiones), pero la causa no es la plantilla:

- El título ya cubre la demanda — `Sunrise and sunset in Tokyo in October: exact times`.
- **Posición media 8,8**: en los puestos 8-10 un CTR del 1-2 % es lo normal. Eso no se
  arregla con copy.
- Son consultas de **cero clic**: Google responde "sunset in paris august" en la propia
  SERP.

Revisar si la posición media sube a top 3-5 y el CTR sigue por debajo del 2 %.

### Deuda conocida: el slug de Tromsø

Tromsø cumple los dos criterios de la ola 2 (70° de latitud, destino canónico de sol de
medianoche y auroras) y **está fuera a propósito**: su slug inglés resuelve a `troms`
porque la `ø` se descarta en vez de plegarse a `o`. "Troms" es un condado noruego, no la
ciudad. Meterla habría publicado 12 URLs equivocadas.

Arreglarlo no es solo tocar `slugify`: `/en/vitamin-d/troms` **ya está viva en
producción** (200), así que el cambio necesita su propio 301 — la maquinaria existe en
`i18n/cross-locale-redirect.ts`, pero este caso es distinto (cambio de slug, no cruce de
idioma). Tarea aparte; Tromsø entraría en la ola 3.
