# Production Readiness — Assessment y prácticas

> Evaluación realizada el 2026-07-16 sobre `master` (commit `3737a5f`), con los
> huecos críticos/altos cerrados en esta misma rama. La segunda mitad del
> documento son las **prácticas** que mantienen el proyecto production-ready:
> es la parte que hay que releer antes de tocar deploys, seguridad o el
> pipeline de push.

## 1. Veredicto resumido

El producto estaba **funcionalmente maduro pero operacionalmente frágil**: la
lógica científica (solar/UV/vitD) está bien testeada y el diseño del service
worker y del pipeline de push es cuidadoso, pero no había CI, las rutas API
(el código con historial real de incidentes) no tenían ni un test, la tabla de
suscripciones push era legible y borrable por cualquiera con la clave anon
pública, no había cabeceras de seguridad, ni error boundaries, ni timeouts
contra Open-Meteo, y el cron podía fallar al 100% sin que nadie se enterase.

Tras los fixes de esta rama, el estado es: **listo para producción con dos
acciones manuales pendientes** (aplicar la migración de RLS en Supabase y
configurar `VAPID_CONTACT`; ver §4).

## 2. Hallazgos del assessment

Severidad: 🔴 crítico · 🟠 alto · 🟡 medio · ⚪ bajo. "Estado" refleja esta rama.

### Seguridad

| Sev | Hallazgo | Estado |
|---|---|---|
| 🔴 | RLS de `push_subscriptions` con 4 políticas `using (true)`: cualquiera con la clave anon pública podía **leer todos los endpoints, claves push y lat/lon de los suscriptores** (fuga de localización), y también actualizar o borrar todas las filas | ✅ Corregido en `supabase/migrations/20260716_lock_down_anon_access.sql` — **pendiente de aplicar en Supabase** |
| 🟠 | `city_names` creada sin RLS: legible y **escribible** por anon (envenenamiento de resultados de búsqueda) | ✅ Misma migración (RLS + política solo-SELECT) |
| 🟠 | Cero cabeceras de seguridad en producción (sin CSP, HSTS, X-Frame-Options, nosniff…); prod tenía *menos* cabeceras que preview | ✅ `next.config.ts` añade CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy y Permissions-Policy en todos los deploys |
| 🟡 | `/api/weather` era un proxy abierto sin validación de entrada; `/api/push/subscribe` aceptaba escrituras ilimitadas con campos sin validar | ✅ Validación de rangos/formatos y clamping en ambas rutas. Rate limiting sigue pendiente (ver §5) |
| 🟡 | Las rutas API devolvían `error.message` interno (Supabase, Open-Meteo) al cliente | ✅ Respuestas opacas + `console.error` en servidor |
| ⚪ | Contacto VAPID `mailto:vitamind@example.com` (riesgo de deliverability) | ✅ Configurable vía `VAPID_CONTACT` — **pendiente de configurar en Vercel** |
| ✅ | Lo que ya estaba bien: sin secretos commiteados, service-role key solo en servidor, cron con Bearer auth fail-closed, `force=true` acotado a un endpoint, sin SQL injection (parametrizado), `.gitignore` completo | — |

### Fiabilidad y observabilidad

| Sev | Hallazgo | Estado |
|---|---|---|
| 🟠 | Sin timeouts en fetches a Open-Meteo; el cron procesa suscripciones en serie, así que una llamada colgada podía tumbar el run entero | ✅ `AbortSignal.timeout(8000)` en todas las llamadas upstream |
| 🟠 | El cron devolvía 200 aunque fallasen todos los envíos y no logueaba nada → fallos invisibles (ya pasó: ~53 y ~58 días rotos) | ✅ Log JSON de cada run + 500 cuando fallan el 100% de los envíos (Vercel lo marca como cron fallido) |
| 🟠 | Sin error boundaries: un throw en render = pantalla en blanco; 404 sin estilo ni idioma | ✅ `global-error.tsx`, `[locale]/error.tsx`, `[locale]/not-found.tsx` localizados |
| 🟠 | `NotificationToggle` marcaba "on" sin comprobar `res.ok` → el usuario creía tener notificaciones que nunca llegarían | ✅ Solo marca "on" tras confirmación del servidor |
| 🟡 | Sync de perfil (`AppProvider`) sin `.catch` → unhandled rejection silenciosa | ✅ Capturado y logueado |
| 🟡 | Precache del SW atómico (`cache.addAll`): un 500 transitorio en un deploy dejaba a usuarios recurrentes clavados en el SW viejo | ✅ Precache por URL con catch individual |
| 🟡 | Sin tracking de errores (Sentry o similar) ni logging estructurado | ⏳ Parcial: ahora hay `console.error` con contexto en todas las rutas (visible en logs de Vercel). Sentry queda como mejora recomendada (§5) |
| 🟡 | Los hooks de datos del cliente no distinguen "cargando" de "upstream caído" (sin estado de error ni retry en UI) | ⏳ Pendiente (§5) |

### Calidad, tests y CI

| Sev | Hallazgo | Estado |
|---|---|---|
| 🟠 | **Sin CI** (no existía `.github/`): ninguna verificación automática entre un cambio y producción | ✅ `.github/workflows/ci.yml`: lint + typecheck + test + build en cada push/PR |
| 🟠 | `npm ci` roto: `package-lock.json` desincronizado con `package.json` → builds no reproducibles | ✅ Lockfile regenerado |
| 🟠 | Rutas API con **cero tests** pese a dos incidentes históricos en el pipeline de push | ✅ 28 tests nuevos (auth del cron, gating de `force`, validación, opacidad de errores) |
| 🟡 | 3 tests rotos (`LanguageSelector` rediseñado sin actualizar tests) y 12 errores de lint | ✅ Suite 251/251 verde, lint y typecheck limpios |
| 🟡 | E2E huérfano: spec de Playwright sin config ni script para ejecutarlo | ✅ `npm run e2e` (es un script standalone, se ejecuta con `BASE_URL=… npm run e2e`) |
| 🟡 | Sin script `typecheck` | ✅ `npm run typecheck` |
| ✅ | Lo que ya estaba bien: la lógica científica validada contra literatura (`uv-literature.test.ts`), el guard de claims de salud multiidioma, i18n de rutas bien testeado, SW versionado por SHA de git | — |

### Documentación

| Sev | Hallazgo | Estado |
|---|---|---|
| 🟠 | `CLAUDE.md` materialmente falso: decía que la app vive en `vitamind/` (no existe), que "no hay tests" (había 21 ficheros) y describía una SPA pre-i18n; el "Root Directory: vitamind" documentado rompería deploys | ✅ Reescrito contra la realidad actual |
| 🟡 | Sin README ni `.env.example` | ✅ Añadidos |

## 3. Qué se cambió en esta rama (resumen técnico)

1. `fix: sync package-lock.json` — restaura `npm ci`.
2. `fix: production-readiness hardening round 1` — migración RLS, cabeceras de
   seguridad, validación de entrada y opacidad de errores en las 4 rutas API,
   timeouts upstream, observabilidad del cron, error boundaries localizados,
   fix del toggle de notificaciones, precache resiliente del SW, tests de
   `LanguageSelector` actualizados y 12 errores de lint resueltos.
3. `feat: CI pipeline, API route tests, typecheck script, .env.example`.
4. Documentación: este documento, `CLAUDE.md` reescrito, `README.md`.

## 4. Acciones manuales pendientes (no automatizables desde el repo)

1. **Aplicar `supabase/migrations/20260716_lock_down_anon_access.sql`** en el
   proyecto Supabase compartido (SQL editor o `supabase db push`). Hasta
   entonces, la fuga de datos de suscriptores sigue viva en producción.
   La app no cambia de comportamiento: todo el acceso del servidor usa la
   service role, que ignora RLS.
2. **Configurar `VAPID_CONTACT`** (`mailto:` de un buzón monitorizado) en los
   dos proyectos Vercel — con `printf '%s' | npx vercel env add …`, nunca `echo`.
3. **Verificar el Root Directory** de ambos proyectos Vercel: la app ya no
   vive en `vitamind/`; si algún proyecto conserva ese valor, limpiarlo.
4. Al desplegar esta rama, comprobar en la consola del navegador que la CSP no
   bloquea nada legítimo (si aparece un aviso de CSP, añadir el origen a la
   lista en `next.config.ts` — no quitar la cabecera).

## 5. Mejoras recomendadas (no bloqueantes)

- **Sentry** (`@sentry/nextjs`) para errores de cliente y servidor con alertas;
  hoy los errores quedan en los logs de función de Vercel, que nadie mira si
  no hay síntoma.
- **Rate limiting** en `/api/weather` y `/api/push/subscribe` (Vercel WAF o
  `@upstash/ratelimit`). Hoy solo hay validación estricta de entrada.
- **Estados de error en la UI de datos** (forecast/weather/city search):
  distinguir "cargando" de "upstream caído" y ofrecer retry.
- **Smoke tests de render** para las ~10 plantillas de ruta y las city pages.
- Convertir el e2e standalone a specs de `@playwright/test` y añadirlo como
  job opcional de CI contra un build local.
- Monitor externo del cron (healthchecks.io o similar: ping al terminar el run).

## 6. Prácticas para seguir siendo production-ready

### Regla de oro

**Nada llega a producción sin CI verde en ese commit.** CI = lint + typecheck
+ tests + build (`.github/workflows/ci.yml`). Los deploys son manuales
(`npx vercel --prod`), así que esta disciplina es del humano que despliega:
GitHub no puede bloquear un `vercel deploy`.

### Checklist de deploy a producción

1. CI verde en el commit exacto que se despliega.
2. ¿Hay migraciones nuevas en `supabase/migrations/`? → aplicarlas en Supabase
   **antes** del deploy del código que las necesita.
3. `npx vercel --prod --yes` (verificar que `.vercel/` apunta a `vitamind`).
4. Post-deploy (2 min): abrir https://getvitamind.app, consola sin errores de
   CSP, `bash scripts/smoke-i18n.sh` con `BASE=https://getvitamind.app`, y si
   se tocó el pipeline de push, un test manual con `?force=true` en dev.

### Seguridad

- **RLS:** las tablas server-only (`push_subscriptions`) no llevan políticas
  anon; `city_names`/`cities` son solo-SELECT. Nunca añadir `using (true)`
  para "arreglar" un error de acceso — el fix correcto está en la ruta API con
  service role. Toda tabla nueva nace con `enable row level security` y las
  políticas mínimas.
- **Cabeceras:** la CSP vive en `next.config.ts`. Si un recurso externo nuevo
  falla, se añade su origen a la directiva correspondiente; la cabecera no se
  relaja ni se elimina.
- **Rutas API nuevas:** validar/clampar toda entrada, no devolver nunca
  `error.message` interno al cliente (loguear con `console.error` y responder
  opaco), y decidir explícitamente auth (¿quién puede llamarla?).
- **Secretos:** solo en env vars de Vercel (`printf '%s'`, jamás `echo` — ver
  incidentes en CLAUDE.md). Nada de secretos en el repo; `SUPABASE_SERVICE_ROLE_KEY`
  jamás con prefijo `NEXT_PUBLIC_`. Tras tocar env vars, ejecutar el detector
  de corrupción documentado en CLAUDE.md.

### Tests

- Todo bug que llegue a producción gana un test de regresión antes del fix.
- Cambios en el pipeline de push (subscribe/notify/push-store) exigen tests:
  es el código con historial real de incidentes silenciosos.
- Los tests de `messages/__tests__/health-claims.test.ts` protegen los claims
  de salud en 6 idiomas: si un cambio de copy los rompe, revisar el copy, no
  el test.
- No se desactivan reglas de lint ni tests para "pasar CI"; se arregla la causa.

### Fiabilidad

- Todo `fetch` a un servicio externo desde el servidor lleva
  `AbortSignal.timeout(…)`.
- Los errores se propagan (`throw`) o se loguean; prohibido el patrón
  `catch {}` silencioso en código de servidor (el incidente de 58 días nació
  exactamente de ahí).
- La UI nunca confirma una acción (toggle, guardado) antes del `res.ok`.
- El service worker: mantener el no-`skipWaiting` y el versionado por SHA;
  el precache debe seguir siendo por-URL (no atómico).

### Dependencias y entorno

- `npm install` solo cuando se cambia `package.json`, y el lockfile resultante
  se commitea en el mismo PR (CI usa `npm ci` y falla si se desincronizan).
- Node 22 (el de CI). Actualizaciones de Next/React en PR propio, con CI verde
  y deploy a `vitamind-dev` antes que a prod.
- `.env.example` se actualiza en el mismo PR que introduce una env var nueva,
  y CLAUDE.md (§ env vars) si es operacionalmente relevante.

### Documentación

- CLAUDE.md es la referencia operativa: si un cambio invalida algo escrito ahí
  (rutas, comandos, arquitectura, deploy), se actualiza en el mismo PR. La
  deriva documental de este assessment (decía "no hay tests" con 21 ficheros
  de tests) es el ejemplo de lo que no puede repetirse.
- Los incidentes de producción se documentan en CLAUDE.md (qué pasó, cómo se
  detectó, cómo prevenirlo), como los dos de env vars corruptas.
