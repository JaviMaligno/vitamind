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
