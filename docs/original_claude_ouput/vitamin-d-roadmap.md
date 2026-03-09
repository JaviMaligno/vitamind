# Vitamina D Explorer — Roadmap de Desarrollo

## Estado actual (v5 - Artifact)
- ✅ Mapa real del mundo (Natural Earth + d3-geo)
- ✅ Pan, zoom (scroll + pinch), tap/clic con snap a ciudades
- ✅ Heatmap latitud × día del año con drag interactivo
- ✅ Curva solar diaria con umbral de vitamina D
- ✅ ~80 ciudades built-in + búsqueda vía Nominatim (OpenStreetMap)
- ✅ Favoritos editables, animación temporal, umbrales 45°/50°
- ✅ Soporte móvil (touch, pinch-to-zoom)

---

## Fase 5 — Base de datos completa de ciudades

### Problema
La base built-in tiene ~80 ciudades. Nominatim busca en tiempo real pero
requiere conexión y tiene rate limits (1 req/s).

### Solución recomendada
Usar **GeoNames** (geonames.org) — base de datos abierta con ~200,000 ciudades
con población > 500 habitantes.

**Opción A: Archivo estático (más simple)**
- Descargar `cities15000.zip` de GeoNames (~24,000 ciudades con >15k habitantes)
- Convertir a JSON optimizado (~1.5MB, o ~400KB gzip)
- Incluir: nombre, lat, lon, timezone, país, población
- Cargar como asset estático en la app
- Búsqueda local con fuzzy matching (Fuse.js)

**Opción B: API propia (más escalable)**
- Backend mínimo (Node/Express, o edge function en Vercel/Cloudflare)
- SQLite/PostgreSQL con PostGIS para búsqueda geoespacial
- Endpoint: `GET /api/cities?q=sevilla&limit=10`
- Endpoint: `GET /api/cities/near?lat=51&lon=0&radius=50km`

**Opción C: Google Places API**
- Autocomplete completo como Google Maps
- Coste: ~$2.83 por 1000 requests (con SKU Autocomplete)
- Requiere API key y billing
- Es la UX más pulida pero con coste

### Recomendación
Empezar con Opción A (cities15000 estático). Cubre el 99% de los casos
y es gratis, sin backend, funciona offline.

---

## Fase 6 — Integración meteorológica (nubes en tiempo real)

### Problema
Los cálculos actuales asumen cielo despejado. Las nubes reducen los UVB
hasta un 75-90% dependiendo de la cobertura.

### Fuentes de datos meteorológicos

| API | Coste | Datos UV | Nubes | Límite gratis |
|-----|-------|----------|-------|---------------|
| OpenWeatherMap | Freemium | UV Index ✅ | Sí | 1000 calls/día |
| Open-Meteo | Gratis | UV Index ✅ | Sí | Ilimitado |
| WeatherAPI | Freemium | UV Index ✅ | Sí | 1M calls/mes |
| Tomorrow.io | Freemium | UVB específico ✅ | Sí | 500 calls/día |

### Recomendación: Open-Meteo (gratis, sin API key)

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=51.51&longitude=-0.13
  &hourly=uv_index,cloud_cover
  &forecast_days=3
```

Devuelve UV index y cobertura de nubes por hora para los próximos días.

### Implementación

1. **Indicador de nubes en la curva diaria**
   - Overlay semitransparente gris sobre las horas con nubes
   - Color coding: despejado (dorado), parcial (amarillo tenue), nublado (gris)

2. **"Vitamina D efectiva"**
   - Factor de reducción por nubes:
     - Despejado (0-20%): 100% UVB
     - Parcialmente nublado (20-60%): ~50-75% UVB
     - Nublado (60-90%): ~20-40% UVB
     - Muy nublado (>90%): ~5-10% UVB
   - Mostrar ventana "real" vs "teórica" de vitamina D

3. **Previsión de 3 días**
   - Timeline con los próximos 3 días
   - Marcador verde/amarillo/rojo por día

### Caché
- Guardar respuesta en localStorage por ciudad+fecha (TTL: 1-3 horas)
- No hacer requests innecesarios

---

## Fase 7 — Notificaciones push

### Arquitectura necesaria
Las notificaciones push requieren:

1. **Service Worker** (para recibir notificaciones en segundo plano)
2. **Backend/servidor** (para calcular cuándo notificar y enviar el push)
3. **Push API** (Web Push o Firebase Cloud Messaging)

### Flujo

```
Usuario abre la app
  → Registra Service Worker
  → Pide permiso de notificaciones
  → Envía push subscription al backend

Backend (cron job cada hora):
  → Para cada usuario suscrito:
    → Calcula elevación solar actual en su ubicación
    → Consulta meteorología (Open-Meteo)
    → Si elevación > 45° AND nubes < 40%:
      → Envía push notification: "☀️ Buen momento para vitamina D
        hasta las 14:30. Aprovecha!"
```

### Stack recomendado (mínimo)

**Sin servidor propio:**
- **Firebase Cloud Functions** (gratis hasta 2M invocaciones/mes)
- **Firebase Cloud Messaging** para push
- **Cloud Scheduler** para el cron

**Con servidor:**
- Node.js + `web-push` library
- Cron con node-cron o sistema operativo
- Base de datos para suscripciones (SQLite para empezar)

### Tipos de notificaciones sugeridas

| Tipo | Trigger | Mensaje |
|------|---------|---------|
| Ventana abierta | Elevación > umbral + despejado | "☀️ Sol ideal para Vit D hasta las HH:MM" |
| Ventana cerrándose | 30 min antes de bajar del umbral | "⏰ Última media hora de sol útil hoy" |
| Primer día de temporada | Primer día del año con ventana | "🎉 Hoy es el primer día que puedes sintetizar Vit D!" |
| Resumen semanal | Lunes 9:00 | "Esta semana: 3 días buenos para sol" |

### PWA (Progressive Web App)
Para que funcione como app "instalable" en el móvil:
- Añadir `manifest.json` con iconos, nombre, colores
- Service Worker para caché offline
- El usuario puede "Añadir a pantalla de inicio"
- Se comporta como app nativa

---

## Fase 8 — Ideas adicionales

### Perfil personal
- Tipo de piel (escala Fitzpatrick I-VI) → ajusta tiempo necesario
- Edad → ajusta eficiencia de síntesis
- % de piel expuesta → multiplica tiempo

### Historial y gamificación
- Registrar sesiones de sol (manual o automático con GPS)
- "Racha" de días consecutivos
- Estimación de IU acumuladas

### Compartir
- Generar imagen/card con el estado solar de tu ciudad
- "En Madrid hoy hay 4h12m de ventana de vitamina D"
- Compartir en redes sociales

---

## Stack técnico recomendado para producción

```
Frontend:  React/Next.js + Tailwind + d3
Hosting:   Vercel (gratis para proyectos personales)
Datos geo: GeoNames cities15000 (asset estático)
Meteo:     Open-Meteo API (gratis)
Push:      Firebase Cloud Messaging + Cloud Functions
Auth:      Opcional — Firebase Auth si quieres perfiles
DB:        Firestore o Supabase (gratis tier)
```

### Coste estimado: $0/mes para uso personal, <$10/mes para miles de usuarios
