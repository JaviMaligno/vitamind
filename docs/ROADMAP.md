# Vitamina D Explorer - Roadmap

## Completado (v6 - Next.js)

- Mapa real del mundo (Natural Earth + d3-geo) con pan, zoom, tap/clic
- Heatmap latitud x dia del ano con drag interactivo
- Curva solar diaria con umbral de vitamina D
- ~80 ciudades built-in + 200K+ ciudades GeoNames cities500 en Supabase
- Busqueda fuzzy server-side (pg_trgm) + Nominatim fallback
- Favoritos editables, animacion temporal, umbrales 45/50
- Soporte movil (touch, pinch-to-zoom)
- Modo scrub opcional en mapa (toggle explorar/mover)
- Ubicaciones custom guardables con nombre
- Persistencia localStorage (favoritos, preferencias, cache meteo)
- Integracion Open-Meteo (UV index + cobertura nubes) via API route
- Overlay de nubes en curva diaria
- Proyecto Next.js modular (TypeScript, Tailwind)
- Deploy en Vercel, repo en GitHub
- Curva solar verificada: formula astronomica estandar (NOAA), error <0.3 grados, forma realista confirmada
- Renderizado robusto de curva (buildVisiblePath con interpolacion de bordes, verificado 187K combinaciones)

---

## Completado (Fase 6b - Calculo preciso con UV real)

- Formula Holick/Dowdy (2010): time = target_IU * MED / (24000 * area * UVI)
- MED por tipo Fitzpatrick (I-VI): 200-1200 J/m2
- Umbral UVI >= 3 para sintesis
- Cap a 1/3 MED (rendimiento decreciente)
- Selector de piel con guia Fitzpatrick interactiva (boton ?)
- Presets de area expuesta (10%-40%)
- Panel de resultados: minutos para 1000 IU, mejor hora, ventana UV
- Grafico de barras por hora coloreado por tiempo necesario
- Persistencia de preferencias en localStorage

---

## Completado (Fase 6c - Mejora de UX/UI)

- Rediseño completo con layout de 3 zonas: Hero (respuesta inmediata), Visualizacion (tabs), Configuracion (colapsable)
- Migracion de inline styles a Tailwind CSS
- Extraccion de hooks: useLocation, useWeather, usePreferences, useAnimation, useGeoLocation
- Componentes: HeroZone, VisualizationZone, ConfigZone
- Botones con min-height 44px para accesibilidad movil
- Jerarquia visual clara: respuesta grande, visualizaciones en tabs, controles ocultos por defecto

---

## Completado (Fase 7 - Notificaciones push)

- Web Push API con VAPID keys (web-push library)
- Service Worker: push event handler + notification click abre la app
- API routes: POST/DELETE /api/push/subscribe, GET /api/push/notify
- Vercel Cron: check diario a las 8:00 UTC
- Notificacion incluye: minutos para 1000 IU, ventana solar, UV pico
- Auto-limpieza de suscripciones expiradas (410/404)
- Actualiza suscripcion al cambiar ciudad/piel/area
- Toggle de notificaciones en el banner de estado
- Persistencia de suscripciones en Supabase (push_subscriptions table + RLS)

---

## Completado (Fase 8 - Perfil personal)

- Auth opcional via Supabase (app funciona completamente sin cuenta)
- AuthButton en header: login/signup/logout
- On login: sincroniza perfil cloud -> local
- Profile sync: localStorage siempre, Supabase cuando hay sesion
- Campo edad con factor Holick 1989 (-1.3%/año desde 20, min 0.5)
- Tabla profiles con RLS (docs/supabase-schema.sql)
- Supabase configurado (proyecto + env vars en Vercel)
- Estimacion teorica cielo despejado para fechas sin datos meteo (modelo Madronich)

---

## Completado (Fase 9 - PWA)

- manifest.json con iconos (192, 512, maskable), nombre, colores
- Service Worker con cache-first para assets, network-first para paginas
- Pagina offline con boton de reintentar
- Apple Web App meta tags (capable, status-bar-style, touch-icon)
- Favicon SVG con icono sol+D
- "Anadir a pantalla de inicio" en movil
- Comportamiento tipo app nativa (display: standalone)

---

## Completado (Fase 10 - v2 Redesign)

- GPS auto-deteccion (navigator.geolocation) con fallback a busqueda de ciudad
- Base de datos de ciudades migrada a Supabase (200K+ ciudades GeoNames cities500)
- Busqueda de ciudad por nombre (pg_trgm) y por proximidad GPS
- API route /api/cities para busqueda server-side
- i18n con next-intl: 6 idiomas (ES, EN, FR, DE, RU, LT)
- Selector de idioma en header
- Deteccion automatica de idioma del navegador
- SEO: meta tags OpenGraph/Twitter, JSON-LD structured data
- Vercel Analytics integrado
- Push notifications: fix critico (RLS bloqueaba escritura de suscripciones)
- Push notifications: soporte test manual (?secret=), mejor reporte de errores
- Testing: vitest configurado con smoke tests para solar math

---

## Pendiente de verificacion

- [x] PWA: instalable en movil
- [x] PWA: modo offline
- [x] Estimacion teorica UV para fechas >14 dias
- [ ] Auth: persistencia de perfil (login -> cambia preferencias -> logout -> login -> se mantienen?)
- [ ] Auth: sincronizacion cloud <-> localStorage al iniciar sesion
- [ ] Push notifications: recibir notificacion diaria a las 8:00 UTC (re-suscribirse tras fix)
- [ ] Push notifications: contenido correcto (minutos, ventana solar, UV pico)
- [ ] Estimacion con datos reales: muestra minutos, mejor hora, barras por hora para fecha de hoy
- [ ] Seed de ciudades: ejecutar scripts/seed-cities.ts en Supabase produccion

---

## Futuro - Modelo de exposicion refinado (basado en evidencia)

Mejoras al motor de calculo y a la UX derivadas del FAQ "Es lo mismo 10 minutos seguidos al sol que 10 veces 1 minuto?" (learn block1.q8).

El motor actual (lib/vitd.ts) ya implementa MED por tipo Fitzpatrick, modelo saturante exponencial con cap a 1 MED (Holick 1982; de Gruijl 2016) y umbral UVI >= 3. Lo que falta es superficie para el usuario y contabilidad acumulada en tiempo real.

- Contador de exposicion en tiempo real (dose tracker)
  - Que: integrar UVI(t) x tiempo en una "stopwatch" que muestra IU acumuladas a lo largo del dia mientras el usuario esta al sol.
  - Dificultad: Media-Alta. Tracking pasivo fiable necesita geolocation activa o sensor de luz ambiente y choca con limites de background en PWA.
  - Viabilidad: Alta como sesion manual ("iniciar/parar sesion al sol"); Media para tracking pasivo. App nativa lo haria mejor.
  - Valor: Muy alto. Convierte la app de prediccion en medicion real y la diferencia frente a apps de UV genericas.

- Agregacion diaria multi-sesion con conciencia de cinetica termica
  - Que: sumar IU producidas en varias sesiones fragmentadas del mismo dia. Cada sesion truncada a maxSessionIU por bout (1/3 MED zona de rendimiento, techo 1 MED). Conversion previtamin D3 -> vitamin D3 con vida media ~2.5 h, completa en ~8 h: justifica ventana de 24 h como horizonte natural.
  - Dificultad: Baja-Media. Es contabilidad sobre el motor existente; basta persistir sesiones (localStorage / Supabase) y agregar.
  - Viabilidad: Alta.
  - Valor: Alto. Refleja el patron real de uso (varias salidas cortas) y refuerza el mensaje cientifico del FAQ q8.

- Barra de progreso MED y alerta de sobreexposicion
  - Que: mostrar % de MED diario alcanzado en la zona expuesta y avisar antes de aproximarse a 1 MED (riesgo de eritema).
  - Dificultad: Baja. El dato ya existe en el motor (med = MED[skinType] / uvi); solo falta surfacearlo en UI.
  - Viabilidad: Alta.
  - Valor: Alto. Feature de seguridad unica, alineada con el discurso "el sol no intoxica pero si quema".

- Recomendacion adaptativa "objetivo cumplido"
  - Que: cuando el dose tracker confirma que se ha alcanzado el target diario (p.ej. 1000 IU), cambiar el copy de "necesitas X minutos mas" a "objetivo cubierto, considera sombra/protector".
  - Dificultad: Baja una vez exista el tracker.
  - Viabilidad: Alta.
  - Valor: Medio-Alto. Cierra el bucle prediccion -> medicion -> accion.

- Visualizacion de la curva de saturacion por sesion
  - Que: en VitDEstimate o en el grafico horario, mostrar la curva saturante con marcadores en 1/3 MED ("rendimientos decrecientes") y 1 MED ("riesgo de quemadura"). El modelo ya se aplica internamente (lib/vitd.ts: minutesForVitD), pero no se ve.
  - Dificultad: Media. Componente de grafico nuevo o extension de DailyCurve.
  - Viabilidad: Alta.
  - Valor: Medio. Educativo, refuerza diferenciacion cientifica de la app.

- Mostrar MED personal junto al selector de piel
  - Que: render del MED concreto del usuario (p.ej. "Tu DEM a UVI 6 = ~21 min") debajo de SkinSelector. Pequena explicacion de que es la dosis hasta enrojecer y por que importa.
  - Dificultad: Trivial.
  - Viabilidad: Alta.
  - Valor: Medio. Educativo y aumenta confianza en la personalizacion.

Notas:
- Una version "lite" del tracker como sesion manual ("Pulsa cuando salgas al sol / cuando entres") cubre el 80% del valor con 20% del coste y sin permisos invasivos.
- Tracking pasivo serio requiere considerar privacidad (geolocation continua) y bateria.
- La cinetica termica de ~8 h justifica una ventana diaria de 24 h como unidad natural de agregacion.

---

## Futuro - Funcionalidades adicionales

- Autodeteccion tipo de piel con foto (IA / vision model)
- Chat IA / preguntas comunes sobre vitamina D y sol
- Mensaje contextual de suplementacion (cuando no hay ventana de sintesis)
- Onboarding guiado para nuevos usuarios
- Tooltips y explicaciones contextuales
- Accesibilidad avanzada (aria labels, navegacion por teclado)
- OG image personalizada (screenshot/heatmap)
- Assets para Product Hunt (screenshots, GIF animado con Remotion)

---

## Futuro - App movil nativa

- Evaluar si PWA es suficiente o se necesita app nativa
- Si nativa: React Native / Expo (reutiliza logica de lib/)
- Ventajas nativa: notificaciones mas fiables, presencia en stores
- Solo si la PWA se queda corta en funcionalidad o UX

---

## Estrategia comercial

- Ver docs/original_claude_ouput/vitamin-d-estrategia-comercial.md para plan detallado
- Lanzamiento: Product Hunt, Reddit, Hacker News, Twitter/X
- B2C: freemium (gratis + Pro 2.99€/mes)
- B2B: partnerships con marcas de suplementos
