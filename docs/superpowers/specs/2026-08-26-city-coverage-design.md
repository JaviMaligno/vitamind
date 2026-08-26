# Cobertura de ciudades: CTA honesto (PR A) + página de ciudad bajo demanda (PR B)

Fecha: 2026-08-26 · Rama: `feat/city-coverage` (desde `origin/master`, 5b2cf95)
Estado: spec aprobado en sus dos decisiones de producto (opciones A y B); pendiente de plan.

---

## 1. Problema

En **Mi Día** (`app/[locale]/dashboard/page.tsx:112`) y en **Explorar**
(`app/[locale]/explore/page.tsx:142`) se pinta `components/CityPageLink.tsx`, un chip
que enlaza a la página SEO de la ciudad. El chip resuelve su destino con
`targetCityBase` (`lib/city-client-links.ts:36`):

- Si el `cityId` empieza por `builtin:`, enlaza a esa ciudad. Correcto.
- Si no —y no empieza por `builtin:` **ninguna** ciudad salida del buscador, que
  devuelve ids `geonames:*`, ni el fix de GPS, ni el toque en el mapa, que emite
  `custom:${Date.now()}`— busca la built-in más cercana con `maxKm = 400` y enlaza a
  ella **sin decir la distancia**.
- Si no hay nada en 400 km, devuelve `null` y el chip **desaparece sin explicación**.

El texto es `cityPage.viewCityPage` = "Ver la página completa de {city}", e interpola
el nombre de la ciudad **destino**. Así que buscas Toledo y el botón dice "Ver la
página completa de **Madrid**", sin decir en ningún momento que Madrid no es Toledo ni
a qué distancia está.

Las cifras de lo que eso significa, ya medidas:

| Magnitud | Valor |
|---|---|
| Ciudades con página curada (`BUILTIN_CITIES`) | 73 → 438 rutas (73 × 6 locales) |
| Ciudades buscables (GeoNames cities15000) | 33.390 |
| A < 50 km de su built-in más cercana | 13 % |
| A 50–150 km | 10 % |
| A 150–400 km | 23 % |
| A > 400 km — **el chip no aparece** | **54 %** |
| De las de 50–400 km, con \|Δlat\| ≥ 1° | 53 % |
| De las de 50–400 km, con \|Δlat\| ≥ 2° | 21 % |

Y el error no es cosmético. Medido con el propio modelo del repo (`cityYearProfile`,
`viableDateBoundaries`, `lib/uv-model.ts`): de los **15.479 enlaces** que crea hoy la
regla de 400 km, el **37,1 %** tiene \|Δlat\| > 1° y el **14,6 %** tiene \|Δlat\| > 2°.
Sobre muestra con perfil anual calculado, el **14,8 %** de los usuarios enlazados lee
un **conjunto de meses distinto del suyo** en la página a la que se le manda.

**La asimetría que lo convierte en bug y no en decisión.** El índice `/vitamina-d`
(`components/CityIndexSearch.tsx`) **ya es honesto**: pinta los km por tarjeta y elige
entre `cityPage.indexNearestDistance` ("La más cercana está a {km} km") e
`cityPage.indexNoneNearby` ("Ninguna está muy cerca, pero estas son las más
próximas"), ambas ya traducidas a los 6 idiomas. Ese patrón nunca se aplicó al chip.
La misma app dice la verdad en una pantalla y la calla en las otras dos.

Ampliar la lista curada no arregla esto: la cobertura óptima (greedy, radio 50 km,
sobre la población del top-3000 mundial) es 39 % con 73 ciudades, 52 % con 150, 66 %
con 300 y 72 % con 400. La curva es logarítmica.

---

## 2. Alcance

### PR A — CTA honesto y unificación de umbrales

Solo cliente y copy. No toca base de datos, no toca el sitemap, no cambia ningún
número calculado.

1. Extraer `lib/geo-distance.ts`: **el haversine, sin imports**, y migrar a él las
   cuatro copias byte-distintas y numéricamente idénticas que hay hoy
   (`lib/nearest-city.ts:7`, `lib/continent.ts:41`, `lib/city-nearby.ts:8`,
   `lib/city-client-links.ts:23`).
2. Convertir `lib/nearest-city.ts` en el **único** módulo que contesta "qué built-in
   hay cerca de esta coordenada", con primitivas que **siempre devuelven la
   distancia** —ese es el cambio de fondo, porque es lo que permite a la UI decir los
   km en vez de fingir— y alojar ahí las constantes de esa familia.
3. Reescribir el chip con **tres ramas de copy** (§4), ninguna de las cuales
   desaparece en silencio.
4. Bajar el umbral de fraseo del índice de 500 km a 100 km y compartir constante con
   el chip, para que índice y CTA dejen de contradecirse.
5. Borrar el código muerto: `findNearestCity` (`lib/cities.ts:63`),
   `selectFromHeatmap` (`hooks/useLocation.ts:83-93`) y el campo del contexto
   (`context/AppProvider.tsx:50` y `:191`).
6. Dejar un test que fije que el chip **imprime los km** cuando el destino no es la
   ciudad buscada. Hoy no hay ninguno: ningún test clava 400, 500 ni `NAME_MATCH_KM`.

### PR B — página de ciudad bajo demanda

1. Migración SQL: `cities.slug TEXT UNIQUE`, `cities.elevation SMALLINT`, RPC
   `city_by_slug(p_slug, p_locale)`.
2. Re-siembra de `cities` con el slug inmutable y la elevación (columna `dem` del
   volcado de GeoNames).
3. `lib/city-dynamic.ts` y la rama dinámica de
   `app/[locale]/[cityPrefix]/[city]/page.tsx`.
4. Política de indexación: `noindex, follow`, canonical auto-referente, **fuera del
   sitemap y fuera de IndexNow**, con tests que lo claven.

### FUERA — no se hace en ninguna de las dos

Blindaje explícito contra scope creep. Cada línea es una cosa que alguien va a
querer meter y que no entra:

- **Opción C — mover el contenido de la página de ciudad dentro de Mi Día.**
  Rechazada por el usuario. Además la página de ciudad no es solo el veredicto anual:
  lleva `SunTimesPanel` y `MonthlySunTable` (amanecer, ocaso, hora dorada, tabla
  mensual). Meter eso en Mi Día es rehacer Mi Día, no arreglar un chip.
- **Retirar páginas built-in.** Ver la decisión D-11. Ni las 73 ni el subconjunto de
  33 sin páginas mes.
- **Arreglar el RPC euclídeo-en-grados** (`search_cities_nearby(_localized)`,
  `supabase/migrations/20260320_city_names.sql:64`) y la adopción de
  `city.tz` / `city.timezone` en `context/AppProvider.tsx:98-105`. Es la única de las
  implementaciones que además de etiquetar **cambia el cálculo**: mueve las horas de
  la ventana de usuarios nórdicos, canadienses y rusos. PR propia, con verificación
  propia. Ficha aparte.
- **El id inestable `custom:${Date.now()}`** de `components/WorldMap.tsx:148`. Rompe
  la persistencia de preferencias y es un bug real, pero PR A lo deja de sufrir (mide
  por coordenadas, no por id) y arreglarlo toca persistencia. Ficha aparte.
- **Tocar `NAME_MATCH_KM` (75 km), `ELEVATION_MATCH_KM` (25 km), `SAME_PLACE_KM`
  (25 km) o el top-N sin umbral de `nearbyCities`.** Ver D-2.
- **Hubs de hoy (`/amanecer/{slug}`) y páginas mes para ciudades dinámicas.** Es la
  familia que se lleva 99 de los 101 clics del sitio; multiplicarla bajo demanda es
  otro proyecto, y hasta que exista la capa dinámica no puede sustituir a una
  built-in.
- **Meter ciudades dinámicas en `app/sitemap.ts` o en IndexNow.** Prohibido por
  diseño y clavado por test (§5).
- **El bug del offset sondeado a medianoche en días de cambio de hora** (378 páginas).
  No relacionado; tiene su propia PR pendiente.

---

## 3. Decisiones

| # | Decisión | Elección | Razón |
|---|---|---|---|
| D-1 | ¿Un umbral o varios? | **Cuatro preguntas distintas sobreviven**, cada una con su constante; ninguna se fusiona | El usuario aceptó más de un umbral "si el caso de uso es distinto". Las preguntas son: (a) ¿puedo **afirmar** este nombre como hecho sin km? (b) ¿esta página **describe** al usuario? (c) ¿hasta dónde tiene sentido **ofrecer** un enlace con los km puestos? (d) ¿puedo decir la **palabra** "cerca"? Son cuatro preguntas, no cuatro versiones de una |
| D-2 | ¿Y las otras cuatro implementaciones? | `NAME_MATCH_KM` = 75 km, `ELEVATION_MATCH_KM` = 25 km, `SAME_PLACE_KM` = 25 km y `nearbyCities` (sin umbral) **no se tocan** | `NAME_MATCH_KM` es el único sitio donde una ciudad se afirma desnuda, y su comentario de cabecera ya es la doctrina correcta del repo: lo que hay que hacer es que el resto se le parezca. `ELEVATION_MATCH_KM` no responde "qué ciudad" sino "qué altura", y alimenta el cálculo. `SAME_PLACE_KM` es deduplicación entre dos puntos, sin ciudad de por medio; que coincida en valor con la anterior debe **seguir siendo coincidencia**, o ajustar la agrupación del historial movería en silencio las altitudes que consume el MCP. `nearbyCities` es crawl, no proximidad percibida: ponerle umbral dejaría a Reikiavik y Perth huérfanas en el grafo |
| D-3 | ¿Criterio en km o en latitud? | **Latitud para la equivalencia, km solo como cota de absurdo** | Los km no predicen el error; la latitud sí. Fijada \|Δlat\| ≤ 0,5°, la fracción de veredictos que cambia es 5,0 % por debajo de 150 km, 4,7 % entre 150 y 300 km y 2,7 % entre 300 y 600 km: **plana**, o sea que la distancia no aporta información. Con \|Δlat\| > 2° sube a 34,6 % y 39,4 %. 400 km al este no cambian nada; 400 km al norte son 3,6° de latitud. Pero la latitud sola no acota nada en el eje este-oeste (Lisboa y Vladivostok comparten latitud), así que hace falta un tope en km puramente para no ofrecer otro continente |
| D-4 | Valor de la banda de equivalencia | `EQUIVALENT_LAT_DEG = 1.0`, `EQUIVALENT_LAT_DEG_TROPICS = 3.0` bajo `TROPIC_LAT = 23.5`, más `EQUIVALENT_LON_DEG = 5` | La curva de error es suave, sin rodilla (3,9 % a 0,25°; 7,1 % a 0,5°; 12,3 % a 1,0°; 24,1 % a 2,0°): el corte es un compromiso explícito. 1,0° es donde el desplazamiento del borde de temporada sigue en la escala de la propia métrica (mediana 3,5 días, p90 6 días), mientras que a 2° ya es p90 10,5 y a 3° p90 16 días —media quincena sobre una fecha que la página imprime como dato exacto. Y conserva mucha más cobertura: enlaza el 32,9 % de las buscables (37,2 % ponderado por población) frente al 23,2 % / 26,8 % de 0,5°, a cambio de 5,9 % de veredictos distintos en vez de 4,1 % |
| D-5 | ¿Por qué el trópico es un régimen aparte? | Porque medido **no cambió el veredicto en ninguno** de los pares tropicales, ni con 4° de desplazamiento | En \|lat\| < 23,5° la síntesis es posible los 12 meses y `contiguousMonthRange` devuelve `null`: no hay borde de temporada que mover. Una constante global de 1° tiraría enlaces correctos en Bombay, Bangkok, Lagos, Singapur, Bogotá, Nairobi o Kuala Lumpur. Fuera del trópico las cuatro bandas se comportan casi igual a 1° (19,8 % / 21,1 % / 17,0 % / 20,0 %): **la única frontera real es el trópico**, no hace falta un tercer régimen |
| D-6 | ¿Por qué un tope de longitud en la banda silenciosa? | `EQUIVALENT_LON_DEG = 5` (~20 min de tiempo solar) | Para el **veredicto anual** la longitud es casi irrelevante: 5° cambian el veredicto en el 2,0 % de los pares, menos que 0,25° de latitud (28 km). Pero la página **imprime horas de reloj**, y ahí sí: con el huso fijo, 1° de longitud ya cambia la hora entera de inicio o fin de ventana en el 10 % de los días, 5° en el 53 %. El salto nunca pasa de 1 hora. 5° es el tope blando; la regla actual de 400 km ya lo cumple de facto en el 99,5 % de los enlaces (p99 de \|Δlon\| = 4,32°) |
| D-7 | Valor de la cota de oferta | `OFFER_LAT_DEG = 3.0` **y** `DIRECTORY_OFFER_KM = 1500` (ambas condiciones) | Con los km impresos, la oferta ya no miente, así que la cota deja de ser una cota de verdad y pasa a ser una de **utilidad**. Más allá de 3° de latitud la página cuenta otra historia (35,9 % de veredictos distintos) y el usuario está mejor servido por el índice, que le enseña 8 candidatos con sus distancias, que por un único enlace a 1.400 km. El tope de 1.500 km existe solo para el eje este-oeste, que la latitud no acota. Es un número elegible: si se prefiere 1.000 o 2.000, la justificación no cambia |
| D-8 | Dónde vive la geometría compartida | **Dos módulos, no uno**: `lib/geo-distance.ts` (haversine puro, **cero imports**) y `lib/nearest-city.ts` (las preguntas sobre built-ins y sus constantes) | `lib/continent.ts` es la que consume una isla cliente (`CityIndexSearch`), que vive sobre el índice SSG con 73 enlaces en el HTML: si el módulo de geometría importara `BUILTIN_CITIES` o `lib/flag`, se arrastrarían al bundle. Y un fichero-de-todos-los-umbrales es exactamente cómo un umbral acaba arrastrando a otro |
| D-9 | Qué pasa cuando no hay nada cerca | **Nunca desaparecer**: enlazar al índice `/vitamina-d` con `indexPath(locale)` (ya existe, `lib/city-client-links.ts:10`) y copy propio | El índice ya resuelve ese caso bien: 8 tarjetas con km y el copy `indexNoneNearby`. Desaparecer sin explicación es la peor de las opciones y hoy le pasa al 54 % de las ciudades buscables |
| D-10 | Copy del chip | Tres ramas: exacta (sin km) / cercana (**con km**) / índice. Ver §4 | Es el mismo trato que el índice ya da. Subir la cota de oferta solo es defendible **después** de imprimir los km, nunca antes |
| D-11 | ¿Se retiran páginas built-in? | **No.** Ni ahora ni como parte de B | El dato que invita a retirarlas (35 impresiones, 0 clics en 28 días) mide las 438 páginas `vitamina-d`, **no las 73 built-in**. `SUNRISE_CITIES` (`lib/sun-routes.ts`) es literalmente una lista de 40 base-slugs built-in, y de ahí cuelgan las 2.880 páginas mes y los 240 hubs que se llevan **99 de los 101 clics del sitio**. Además `BUILTIN_CITIES` es el corpus de fallback de cinco subsistemas, incluida `inferElevationM`, que es **la única fuente de elevación que tiene la app hoy** —de la que depende B—. El ahorro es cero: esas 438 son `revalidate = false` desde el 22-08, no generan escrituras recurrentes. Y el coste no lo es: 438 de 3.070 páginas indexadas es el 14 % de la huella, borrada de golpe en un dominio con 19 enlaces entrantes, a cambio de un upside de 0 clics. La dirección correcta es la contraria: **hacer crecer la lista curada promoviendo ciudades dinámicas con demanda medida** |
| D-12 | Esquema de URL de B | Mismo prefijo, un solo segmento, **slug siempre cualificado por país**: `/{CITY_PREFIX[locale]}/{slugify(ascii)}-{cc}`, con `-{geonameid}` al desempatar. Slug **no** localizado | Con el slug desnudo hay choque con las curadas en 49 (es), 69 (en), 55 (fr), 54 (de), 69 (ru) y 5 (lt) casos (`shanghai`, `lagos`, `lima`, `bogota`…). El sufijo `-cc` los elimina **todos**: de los 194 slugs built-in distintos, cero termina en `-xx`, así que los dos espacios de nombres son disjuntos. Entre GeoNames, `-cc` baja las colisiones de 1.376 grupos / 3.329 registros a 844 / 1.072 (3,2 % del dataset). Cualificar **siempre**, no solo al colisionar, hace el slug función pura de (nombre, país) en vez de depender de un dataset mutable. No localizar: para la cola larga el ASCII de GeoNames es lo que la gente teclea, localizar multiplicaría por 6 una superficie que va a ir `noindex`, y elimina toda una clase de colisiones cruzadas entre locales |
| D-13 | Resolución de datos de B | **Supabase**, RPC `city_by_slug` llamada desde el server component, envuelta en `cache()` de React. **No** `public/cities15000.json`, **no** `fetch("/api/cities")` | El JSON local está descartado por calidad del dato, no por peso: su campo `t` es exactamente `round(lon/15)` en **los 33.390 registros sin una sola excepción** —hora solar media, no zona civil—. Madrid t=0 (real +1), Estambul t=2 (real +3), Reikiavik t=−1 (real 0), Calcuta y Katmandú ambas 6. Publicar amanecer y ocaso desde ahí sería imprimir una hora equivocada en Madrid **los 365 días, en HTML cacheado para siempre**. La tabla `cities` sí tiene `timezone TEXT` (IANA), `lib/cities-api.ts` ya la convierte y `getSunTimes`/`monthlySunTimes` ya prefieren el nombre IANA sobre el offset fijo, con lo que las dinámicas quedan al nivel de las 438, DST incluido. Y `fetch` a la propia API es un salto de red que además no existe en tiempo de build |
| D-14 | Elevación | **Bloqueante de B.** `cities.elevation SMALLINT` sembrada desde la columna 16 (`dem`) del volcado; B no sale sin ella | No está ni en el JSON ni en la tabla, y `lib/city-content.ts` usa `elevationM = 0` por defecto. Medido con el modelo real (`UVI_ALTITUDE_GAIN_PER_KM = 0.08`): de las 73 built-in, **5 cambian de número de meses solo con poner su elevación a cero** —Edimburgo 5→6 (47 m), Moscú 5→6 (150 m), Phoenix 11→12 (331 m), Sídney 11→12 (58 m), Vancouver 6→7 (33 m)—; a 1.500 m cambian 25 de 73 y a 2.500 m, 34 de 73. Publicar Bogotá (2.640 m), Cusco (3.399 m), Ciudad de México o Denver a nivel del mar imprimiría un **titular equivocado**. Se usa la columna 16 (`dem`) y no la 15 (`elevation`), que suele venir vacía |
| D-15 | Política de indexación de B | `robots: { index: false, follow: true }`, canonical **auto-referente**, hreflang completo, **fuera del sitemap**, **fuera de IndexNow**, `robots.txt` sin tocar | "No perder SEO" se cumple **no apostando**. La familia `vitamina-d` rinde 35 impresiones y 0 clics en 28 días con 438 URLs; multiplicar esa plantilla por 458 (33.390 × 6 = 200.340 URLs) es la definición de contenido thin sobre un dominio con 19 enlaces. Canonical a la built-in más cercana está **prohibido**: canonical significa "esta es la misma página", y Toledo no es Madrid. `robots.txt` no sirve porque el prefijo `/vitamina-d/` lo comparten las 438 curadas |
| D-16 | Clase de caché de B | Compartir fichero de ruta y `revalidate = false`; estática-bajo-demanda | `dynamicParams` no está exportado en ningún sitio del repo, así que ya vale `true` por defecto: la ruta **ya acepta** parámetros arbitrarios hoy y los rechaza `resolveCity` con `notFound()`. El único cambio es lo que hace `resolveCity`. Y `revalidate = false` es correcto para **ambas** familias —el contenido es función pura de (lat, lon, elevación, tz, `DOY_REFERENCE_YEAR`) y nada en el render lee el reloj—, así que compartir fichero **no** reintroduce el problema del commit f5d45c7, donde las 438 pagaban el `revalidate` de los 240 hubs |
| D-17 | Camino de graduación | La capa dinámica es un **sensor de demanda**: una ciudad dinámica con uso real se promueve a `BUILTIN_CITIES` en una PR deliberada, y ahí gana slug localizado, sitemap, indexación y malla | Es donde esto **gana** SEO en vez de arriesgarlo: se crece la lista curada desde demanda medida, no desde una apuesta de 200.000 URLs. El criterio concreto es pregunta abierta (Q-4) |

### El esquema de umbrales que queda

| Constante | Valor | Pregunta que responde | Dónde |
|---|---|---|---|
| `NAME_MATCH_KM` | 75 km | ¿Puedo poner el **nombre** de esta ciudad como etiqueta de una coordenada, **sin km al lado**? | `lib/nearest-city.ts` → `hooks/useHistory.ts:222`, `lib/mcp-personal.ts:143` |
| `EQUIVALENT_LAT_DEG` / `_TROPICS` / `EQUIVALENT_LON_DEG` | 1,0° / 3,0° / 5° | ¿Esta página **describe** al usuario, o solo le vale? | `lib/nearest-city.ts` → chip |
| `OFFER_LAT_DEG` + `DIRECTORY_OFFER_KM` | 3,0° + 1500 km | ¿Tiene sentido **ofrecer** esta página con los km puestos, o mejor el índice? | `lib/nearest-city.ts` → chip |
| `NEARBY_PHRASING_KM` | 100 km (era 500) | ¿Puedo decir la **palabra** "cerca" sin cualificar? | `lib/nearest-city.ts` → `CityIndexSearch.tsx:214` |
| `ELEVATION_MATCH_KM` | 25 km (sin cambio) | ¿Puedo tomar prestada esta **altitud** como hecho físico? | `lib/elevation.ts:11` |
| `SAME_PLACE_KM` | 25 km (sin cambio) | ¿Son estas dos coordenadas la **misma estancia**? | `lib/history-window.ts:159` |
| (ninguno) | top-N, n=5 | ¿Qué páginas hermanas **cross-enlazo** para el crawl? | `lib/city-nearby.ts:24` |
| (ninguno) | 20 px proyectados | ¿El dedo ha dado en un **pin**? | `components/WorldMap.tsx:127` |

`NEARBY_PHRASING_KM = 100` no es un número suelto: es la proyección en km de
`EQUIVALENT_LAT_DEG` (1° ≈ 111 km norte-sur). Índice y chip pasan a llamar "cerca" a
lo mismo, que es la asimetría que originó todo esto. Es además el movimiento sin
riesgo funcional: las 8 tarjetas se muestran igual a ambos lados del umbral, con sus
km, y los dos copys ya existen traducidos.

---

## 4. PR A en detalle

### 4.1 API nueva

`lib/geo-distance.ts` (NUEVO, sin imports):

```ts
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number
```

`lib/nearest-city.ts` (reescrito; sigue exportando `haversineKm` como re-export para
no tocar `lib/elevation.ts:2` ni `lib/history-window.ts:5`):

```ts
export function nearestBuiltin(lat: number, lon: number): { city: City; km: number } | null
export function nearestBuiltinWithin(lat: number, lon: number, maxKm: number): { city: City; km: number } | null
export function nearestCityWithin(lat: number, lon: number, maxKm = NAME_MATCH_KM): City | null  // una línea sobre la anterior
```

`lib/city-client-links.ts`: `targetCityBase` se sustituye por

```ts
export type DirectoryTarget =
  | { kind: "exact";   base: string }
  | { kind: "nearby";  base: string; km: number; silent: boolean }
  | { kind: "index" };

export function directoryTarget(cityId: string | undefined, lat: number, lon: number): DirectoryTarget
```

Reglas, en orden:

1. `cityId` empieza por `builtin:` → `exact`.
2. Se busca `nearestBuiltin(lat, lon)`. Si `|Δlat| ≤ EQUIV(lat)` **y**
   `|Δlon| ≤ EQUIVALENT_LON_DEG` → `nearby` con `silent: true`, donde
   `EQUIV(lat) = |lat| < TROPIC_LAT ? EQUIVALENT_LAT_DEG_TROPICS : EQUIVALENT_LAT_DEG`.
   `EQUIV` se evalúa sobre la latitud **del usuario**, no la del destino.
3. Si `|Δlat| ≤ OFFER_LAT_DEG` **y** `km ≤ DIRECTORY_OFFER_KM` → `nearby` con
   `silent: false`.
4. En cualquier otro caso → `index`.

### 4.2 Comportamiento visible, caso a caso

| Caso | Ejemplo | Destino | Texto que ve el usuario (es) | Clave |
|---|---|---|---|---|
| **Ciudad built-in exacta** | Guardas Madrid | `/vitamina-d/madrid` | "Ver la página completa de Madrid" | `cityPage.viewCityPage` (reutilizada, sin cambios) |
| **Equivalente silenciosa** | Getafe → Madrid (Δlat 0,2°, 15 km) | `/vitamina-d/madrid` | "Ver la página completa de Madrid" | `cityPage.viewCityPage` (reutilizada) |
| **Cercana, con distancia** | Toledo → Madrid (Δlat 1,05°, 67 km) | `/vitamina-d/madrid` | "Ver la página de Madrid, a 67 km" | `cityPage.viewNearestCityPage` (**NUEVA**) |
| **Nada útil cerca** | Ushuaia, Nuuk, o cualquiera de las que hoy no ven chip | `/vitamina-d` | "Ninguna ciudad con página está cerca. Ver todas" | `cityPage.viewIndexInstead` (**NUEVA**) |

El caso silencioso mantiene `viewCityPage` **a propósito**: es la única rama donde el
repo se permite nombrar una ciudad ajena sin cualificar, y está justificada por la
medida de D-4 (5,9 % de veredictos distintos, borde de temporada mediana 3,5 días).
Todas las demás dicen la distancia.

### 4.3 Claves i18n

**Se reutilizan** (ya existen en los 6 idiomas, sin tocar):
`cityPage.viewCityPage`, `cityPage.indexNearestDistance`, `cityPage.indexNoneNearby`.

**Se crean** en `messages/{es,en,fr,de,ru,lt}.json`, namespace `cityPage`:

| Clave | es (definitivo) | en (definitivo) | fr / de / ru / lt |
|---|---|---|---|
| `viewNearestCityPage` | `Ver la página de {city}, a {km} km` | `View the {city} page, {km} km away` | **PENDIENTE de traducción nativa** — no rellenar con máquina |
| `viewIndexInstead` | `Ninguna ciudad con página está cerca. Ver todas` | `No city page is nearby. See all cities` | **PENDIENTE de traducción nativa** |

`i18n/client-messages.ts` **no se toca**: el namespace `cityPage` ya está en la lista
(línea 84), y el chip es un componente cliente que ya lo consume. Verificado.

### 4.4 La regla del copy con números

Regla dura del repo: cualquier afirmación en `messages/*.json` que nombre un umbral,
un ángulo, una duración o un criterio es una afirmación sobre `lib/` y hay que
verificarla contra el módulo que la calcula. Cinco afirmaciones caducadas llegaron a
producción por saltársela.

Aquí se cumple **por construcción**: ninguna de las dos claves nuevas contiene un
número literal. `{km}` es un placeholder de ICU que se rellena en tiempo de render.
Lo que sí hay que verificar, y contra qué:

- El valor de `{km}` sale de `haversineKm` en **`lib/geo-distance.ts`**. Test: el chip
  imprime el mismo entero que devuelve `Math.round(haversineKm(...))` para un par
  conocido.
- El redondeo lo hace el componente, no el módulo. `CityIndexSearch` ya redondea sus
  km; **PR A debe usar el mismo redondeo** para que la misma pareja de ciudades no
  salga como 67 km en el índice y 68 en el chip. Test que compare ambas salidas.
- Ninguna clave dice "cerca de X km" ni menciona 75, 100, 400, 1.000 ni 1.500. Si en
  revisión alguien propone añadir un número al copy, entonces sí hay que verificarlo
  contra `lib/nearest-city.ts` y clavarlo en test.

### 4.5 Ficheros que toca PR A

Ruta relativa a `C:\Users\Usuario\github\vitamind\vitamind`.

**Nuevos**
- `lib/geo-distance.ts`
- `lib/__tests__/geo-distance.test.ts`
- `components/__tests__/CityPageLink.test.tsx` (o `lib/__tests__/city-client-links.test.ts` si el chip no se puede montar barato; al menos uno de los dos debe fijar los km)

**Modificados**
- `lib/nearest-city.ts`
- `lib/city-client-links.ts`
- `lib/continent.ts`
- `lib/city-nearby.ts`
- `lib/cities.ts` (borrar `findNearestCity`)
- `components/CityPageLink.tsx`
- `components/CityIndexSearch.tsx`
- `hooks/useLocation.ts` (borrar `selectFromHeatmap`)
- `context/AppProvider.tsx` (borrar el campo del contexto, líneas 50 y 191)
- `messages/es.json`, `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/ru.json`, `messages/lt.json`
- `lib/content-revision.ts` (ver el aviso de §6, R-3: se re-basan los hashes **sin mover la fecha**)

`app/[locale]/dashboard/page.tsx` y `app/[locale]/explore/page.tsx` **no cambian**: el
chip conserva su firma `{ cityId?, lat, lon }`.

---

## 5. PR B en detalle

### 5.1 URL y slug

`/{CITY_PREFIX[locale]}/{slug}` con `slug = slugify(ascii_name) + "-" + cc`, y
`+ "-" + geonameid` cuando ese par ya está tomado. Toledo (ES):

```
es  https://getvitamind.app/vitamina-d/toledo-es
en  /en/vitamin-d/toledo-es
fr  /fr/vitamine-d/toledo-es
de  /de/vitamin-d/toledo-es
ru  /ru/vitamin-d/toledo-es
lt  /lt/vitaminas-d/toledo-es
```

Solo cambia el prefijo. El slug **no** se localiza (D-12). Las 73 curadas sí siguen
localizando el suyo (`nueva-york` / `new-york` / `niujorkas`, `lib/city-slugs.ts`),
porque ahí los exónimos son palabras distintas de verdad.

Precedencia y redirecciones:
- `SLUG_TO_ID` (curadas) se consulta **primero** y siempre gana.
- La forma cualificada de una curada (`/vitamina-d/shanghai-cn`) responde **301** a
  `/vitamina-d/shanghai`: una ciudad, una URL.
- Alias `/{prefix}/id-{geonameid}` → **301** al slug canónico, para el cliente que
  solo tiene el id (el fallback local `lib/geonames.ts`, las tools MCP).
- El slug se asigna **una vez al sembrar** y vive en `cities.slug UNIQUE`. Nunca se
  recalcula: la estabilidad es una propiedad de la base de datos, no de una derivación
  que dependa del orden de población, que GeoNames sí revisa.

### 5.2 Resolución

`lib/city-dynamic.ts` (NUEVO): `resolveDynamicCity(locale, slug)` envuelto en `cache()`
de React para que `generateMetadata` y el `page` compartan **una sola** consulta.
Llama a la RPC `city_by_slug(p_slug, p_locale)`, que hace `LEFT JOIN city_names` y
devuelve `COALESCE(cn.name, c.name) AS display_name` —el mismo patrón que
`search_cities_localized` ya usa. Cliente de Supabase **directo desde el server
component**.

Prefiltro sintáctico antes de tocar la base: `^[a-z0-9-]+-[a-z]{2}(-\d+)?$`. Descarta
la mayoría de la basura sin consulta.

### 5.3 SEO

- `robots: { index: false, follow: true }` en toda página no curada. `follow` para que
  los enlaces internos salientes sigan pasando.
- Canonical **auto-referente**. Nunca a la built-in más cercana.
- hreflang: las 6 locales entre sí + `x-default` a es, igual que `buildCityAlternates`.
  En una página `noindex` el hreflang se ignora, no penaliza, y el día que la ciudad se
  promueva a curada la reciprocidad ya está.
- **Sitemap**: no entran. `app/sitemap.ts` se queda en 3.612 URLs. Solo cambia un
  párrafo de cabecera explicando por qué la familia dinámica está deliberadamente
  ausente.
- **IndexNow**: `scripts/indexnow.ts` construye la lista importando `app/sitemap.ts`,
  así que hoy no filtra nada por sí solo. Se convierte en garantía con un assert.
- `robots.txt` sin cambios (`Allow: /`): prohibir el prefijo bloquearía también las 438
  curadas, que comparten `/vitamina-d/`.
- **Enlaces salientes** de una página dinámica: **solo** al índice `/vitamina-d` y a
  curadas cercanas. Nunca malla dinámica-a-dinámica, y el índice **no** enlaza a
  dinámicas. Con `noindex` la canibalización es cero por definición; el riesgo residual
  es de flujo de enlaces, y esta regla lo cierra.

### 5.4 Caché y coste ISR

El cupo Hobby son 200.000 escrituras/mes. Hay dos cifras de coste por página en
circulación y el CLAUDE.md dice explícitamente que el modelo de escritura está sin
resolver: la optimista (~3.612 unidades por deploy sobre 3.612 rutas ≈ **1
unidad/página**) y la conservadora medida (3.558 rutas ≈ 35.500 unidades ≈ **10
unidades/página**). Con las dos:

- Si las dinámicas fuesen rastreables: 200.340 URLs × 1 = **el cupo entero de un mes**;
  × 10 = **diez veces el cupo**. Cualquiera de las dos es inasumible. Esto **por sí
  solo** justifica noindex + fuera del sitemap + sin enlaces internos rastreables a
  slugs arbitrarios: el gasto queda acotado por tráfico humano, no por rastreadores.
- Acotado por humanos, unas 300 ciudades distintas al mes salen 300–3.000 unidades:
  0,15 %–1,5 % del cupo. Ruido.
- Un deploy invalida las entradas bajo demanda, pero como el conjunto caliente lo fija
  el tráfico humano, recalentar cuesta lo mismo que la primera vez, no más.

**Trampa que hay que medir antes de implementar, no suponer**: si Next cachea también
el resultado de `notFound()` para un parámetro no listado bajo `revalidate = false`,
cada slug basura (`/vitamina-d/aaaa`) escribe una entrada de 404 en caché — una fuente
de escrituras **ilimitada y disparable desde fuera**. El prefiltro sintáctico mitiga
la mayor parte en cualquier caso. Si al medirlo resulta que sí se cachean, el plan B es
servir los desconocidos desde una ruta `force-dynamic` en vez de `notFound()`.
**Medir esto es un paso del plan.**

### 5.5 Ficheros que toca PR B

**Nuevos**
- `supabase/migrations/2026XXXX_city_slug_elevation.sql` — `cities.slug TEXT UNIQUE`
  con índice, `cities.elevation SMALLINT`, RPC `city_by_slug`. **Aplicar a mano antes
  de mergear**, como manda el CLAUDE.md.
- `lib/city-dynamic.ts`
- `lib/__tests__/city-dynamic.test.ts`

**Modificados**
- `scripts/seed-cities.ts` — columna 16 (`dem`) → `elevation`; slug inmutable en la
  siembra, sin recalcular filas existentes (upsert selectivo por columnas).
- `app/[locale]/[cityPrefix]/[city]/page.tsx` — `resolveCity` pasa a async y cae a
  `resolveDynamicCity`; `robots` solo en la rama dinámica; `revalidate = false` **se
  queda**; las cercanas pasan al helper por coordenadas; 301 de `nombre-cc` a la
  curada. **La cabecera del fichero hay que reescribirla**: hoy afirma "ONE FAMILY
  LIVES HERE NOW" y que todo lo que vive ahí está prerenderizado, y las dos cosas dejan
  de ser ciertas.
- `lib/city-nearby.ts` — añadir `nearbyCitiesTo(lat, lon, n)` por coordenadas (siempre
  sobre `BUILTIN_CITIES`, para que todo enlace saliente apunte a una página
  indexable) y dejar `nearbyCities(cityId)` como envoltorio fino.
- `lib/city-client-links.ts` + `components/CityPageLink.tsx` — la rama `exact` pasa a
  cubrir cualquier ciudad buscable con slug; la rama `nearby` queda solo para
  coordenadas crudas (GPS, toque en el mapa).
- `lib/types.ts` — `slug?: string` en `City`.
- `app/api/cities/route.ts` y `lib/cities-api.ts` — devolver `slug` y `elevation`;
  unificar las dos copias de `ccToFlag` (la otra está en `lib/geonames.ts`).
- `lib/geonames.ts` — el fallback local emite la forma alias `id-{geonameid}`.
- `app/sitemap.ts` — la **salida no cambia** (3.612). Solo un párrafo de política.
- `app/__tests__/sitemap.test.ts` — mantener el 3.612 y añadir assert de que ninguna
  URL cualificada aparece.
- `lib/__tests__/indexnow.test.ts` — assert de que el payload nunca contiene una URL
  de ciudad dinámica.
- `messages/{es,en,fr,de,ru,lt}.json` — claves de procedencia ("datos de GeoNames",
  "no es una de nuestras ciudades destacadas").
- `lib/content-revision.ts` — mismo aviso que en A (R-3).

---

## 6. Riesgos

**R-1 · Duplicar el orden de `nearbyCities` publica contenido en 3.558 páginas
"sin cambios".** `lib/city-nearby.ts` **no** está en `CITY_PAGE_MODULES` ni en
`SUN_MONTH_MODULES` de `lib/content-fingerprint.ts` (verificado: la lista son
`solar.ts`, `sun-times.ts`, `city-content.ts`, `city-copy.ts`, `uv-model.ts`,
`vitd.ts`), pero decide el bloque de cross-links de 438 páginas de ciudad + 2.880
páginas mes + 240 hubs, y el propio fichero dice que el **orden** de los enlaces es
contenido. Si el refactor cambia el orden o el `n`, se publica contenido nuevo en
3.558 páginas que el sitemap declara sin cambios — exactamente el fallo que el
CLAUDE.md documenta cinco veces. **Mitigación**: en PR A, `lib/city-nearby.ts` cambia
**solo el import del haversine** y nada más; test que compare la salida contra un
snapshot previo al refactor.

**R-2 · Subir la cota de oferta es un cambio a ciegas y no hay forma de medirlo.**
Hoy el 54 % de las 33.390 no ve nada; después, casi todas verán algo. Y el que veía un
chip mudo a 399 km empezará a ver "312 km" — honesto, pero delata retroactivamente que
antes se le estaba callando. Search Console da 35 impresiones y 0 clics en las páginas
`vitamina-d` en 28 días: **ninguna métrica detectará si el cambio empeora las cosas**.
Se acepta como cambio de corrección, no como apuesta de conversión.

**R-3 · La guarda del fingerprint va a ponerse roja por una razón falsa.**
`CITY_PAGE_NAMESPACES = ["cityPage", "sunTimes"]` y `copyParts` hashea el namespace
`cityPage` **entero**, así que añadir `viewNearestCityPage` y `viewIndexInstead` mueve
`copy.{locale}` de la familia de páginas de ciudad —aunque las 438 páginas **no rendericen
esas claves**: las consume el chip, que vive en Mi Día y Explorar—. El test
`lib/__tests__/content-revision.test.ts` imprime un bloque para pegar **con la fecha de
hoy ya rellenada**, y pegarlo tal cual sería declarar contenido nuevo en 438 URLs
indexadas que no ha cambiado. **Instrucción vinculante**: leer el diff, pegar los
`parts` nuevos y **dejar `CITY_PAGE_REVISION.date` como estaba**. Es un cambio de
instrumento, no de contenido.

**R-4 · Borrar `selectFromHeatmap` es un cambio de API pública del contexto.**
`findNearestCity` es código muerto —ningún componente consume `app.selectFromHeatmap`;
la única pantalla con heatmap, `app/[locale]/explore/page.tsx:58`, define su propio
handler local que solo hace `setExploreCity({lat})` + `setDoy`— pero el campo forma
parte del tipo exportado en `context/AppProvider.tsx:50`. **Mitigación**: `rg` sobre
`widgets/` antes de borrar (`widgets/history`, `widgets/profile`, `widgets/forecast`
tienen bundles generados propios). Si aparece un consumidor, no se borra: migra a
`nearestBuiltinByLatitude(lat, maxDeltaDeg)` con comentario explicando por qué la
latitud es el eje correcto (las horas de síntesis son función de \|lat\| y doy;
`components/GlobalHeatmap.tsx:37` fija `lon = 0` a propósito) **y con la prohibición
explícita de escribir `lon`/`tz`/`timezone` a partir de ese match**, que es lo que hace
hoy `hooks/useLocation.ts:88`.

**R-5 · SEO de B: 200.340 URLs thin.** Es el riesgo grande de todo el proyecto y por
eso lleva cuatro cerrojos independientes (noindex, fuera del sitemap, fuera de
IndexNow, sin malla dinámica-a-dinámica), tres de ellos clavados por test. Un solo
cerrojo no basta: el que falla en silencio es el del sitemap, porque `scripts/indexnow.ts`
lo importa y una URL que se cuele allí acaba **empujada a Bing**, que es exactamente el
movimiento que el propio módulo describe como abusable.

**R-6 · Cambiar el fraseo del índice es visible en una página indexada.** Bajar de
500 a 100 km hace que más usuarios lean "Ninguna está muy cerca" en vez de "La más
cercana está a 430 km". No hay riesgo funcional —las 8 tarjetas se muestran igual a
ambos lados y los dos copys ya existen en los 6 idiomas— pero es un cambio de tono en
`/vitamina-d`, que es la puerta de entrada del crawl.

**R-7 · La elevación es una fuente de error independiente y del mismo orden que la
geografía.** Con la misma lat/lon, pasar de 0 a 500 m cambia el veredicto en el 8,3 %
de los puntos, a 1.000 m en el 15,2 % y a 2.000 m en el 25,5 %: **1.000 m de desnivel
pesa más que 1° de latitud** (12,3 %). La regla de PR A **no cubre ese caso**: un
usuario a nivel del mar enlazado a Bogotá, Ciudad de México, Nairobi, Johannesburgo,
Denver o Medellín puede leer un veredicto más optimista que el suyo aunque la latitud
coincida. PR B lo resuelve (D-14) sirviéndole su propia página con su propia
elevación. Entre A y B, queda abierto y **conscientemente sin guard**.

**R-8 · Sin red de tests hoy.** Ningún test clava 400, 500 ni `NAME_MATCH_KM`
(comprobado sobre `lib/__tests__`, `components/__tests__` y `app/__tests__`). Corta en
los dos sentidos: no hay fricción para el refactor, y tampoco hay red si alguien mueve
los números por accidente. PR A debe dejar al menos el test de los km.

---

## 7. Preguntas abiertas

Todas son de PR B. **PR A no tiene ninguna: se puede planificar y ejecutar ya.**

**Q-1 · ¿Cuántas filas tiene realmente la tabla `cities` de Supabase?**
El brief dice 33.390 (cities15000), pero `scripts/seed-cities.ts` descarga
`cities500.zip` (~200.000 ciudades). Si la tabla lleva cities500, la superficie no es
200.340 URLs sino ~1.200.000, y **todas** las cifras de coste, colisiones y desempate
cambian de orden de magnitud.
*Opciones*: (a) medir con un `select count(*)` antes de escribir el plan de B;
(b) escribir el plan asumiendo cities15000 y ajustar después.
**Recomendación: (a). Es una consulta de un segundo y es la primera tarea del plan de B.**

**Q-2 · Cobertura de `city_names` por locale, en particular ru y lt.**
Si es baja, una página íntegra en cirílico o lituano con el nombre de la ciudad en
alfabeto latino se lee como a medio traducir.
*Opciones*: (a) aceptar el endónimo latino con una línea de procedencia; (b) no servir
la página dinámica en las locales sin traducción y redirigir a es/en; (c) transliterar
con el mapa cirílico que ya existe en `lib/city-slug.ts`.
**Recomendación: (a)**, que es honesta y barata; (b) rompe el hreflang y (c) inventa
nombres. Pero requiere medir la cobertura primero, junto con Q-1.

**Q-3 · ¿Las ciudades dinámicas reciben también hub de hoy y páginas mes?**
Es la familia que se lleva 99 de los 101 clics. Está **FUERA** de B tal como está
planteada, pero de esto depende literalmente el "quizá podamos hasta ahorrarnos páginas
builtin": sin hub ni meses dinámicos, la capa dinámica **nunca** puede sustituir a una
built-in.
**Recomendación: mantenerlo fuera de B y decidirlo con B ya en producción**, cuando se
sepa si las dinámicas reciben tráfico.

**Q-4 · Política de graduación.** ¿Qué promueve una ciudad dinámica a curada — umbral
de población, uso medido, o decisión manual — y quién lo decide? De esto depende que la
capa dinámica sea un **sensor de demanda** (D-17) o solo un parche.
*Opciones*: (a) manual, revisando trimestralmente las más visitadas; (b) automático por
población > N; (c) automático por visitas > N.
**Recomendación: (a) al principio.** Promover es escribir `BUILTIN_CITIES`, seis slugs
localizados y entradas de sitemap: merece un humano hasta que haya volumen.

**Q-5 · ¿Re-sembrar `cities` en caliente o tabla nueva con cambio atómico?**
La tabla sirve el buscador en producción.
*Opciones*: (a) upsert por columnas sin borrar, en caliente; (b) tabla nueva y swap.
**Recomendación: (a)**, porque el upsert solo añade dos columnas y no toca las que el
buscador lee. (b) obliga a duplicar índices y RPCs por un riesgo que (a) no corre.

## 7-bis. Respuestas medidas (2026-08-26)

Las cinco se cerraron consultando Supabase directamente. Ninguna recomendación cambia;
dos cifras sí, y una de ellas por un orden de magnitud.

**Q-1 — RESUELTA: 230.407 filas.** Es cities500, como sospechaba el spec, no las 33.390
de `public/cities15000.json`. Ese fichero es solo el respaldo sin conexión del cliente;
el buscador consulta Supabase. La superficie potencial es **1.382.442 URLs** (230.407 × 6),
no 200.340. Nada del diseño se cae —ninguna se pregenera, todas van `noindex` y fuera del
sitemap— pero confirma que **generar estáticamente es inviable** y que la política de
graduación (Q-4) es la pieza que impide que esto crezca sin control.

Columnas reales de `cities`: `geoname_id, name, ascii_name, country_code, lat, lon,
population, timezone`. Dos consecuencias directas:
- **`timezone` es IANA de verdad** (`Europe/Andorra`), no el `round(lon/15)` del JSON
  local. Confirma D-«datos de Supabase, no del JSON».
- **No hay columna de elevación.** El hueco que el spec marcó como bloqueante es real y
  hay que resolverlo en B, no descubrirlo a mitad.

**Q-2 — RESUELTA: la cobertura depende del tamaño, y el problema es lituano.**
`city_names` tiene 167.640 filas. La media global engaña (es 10,7 %, lt 2,3 %); lo que
importa es la cobertura donde hay ciudades que alguien busca:

| Población | n | en | ru | de | lt |
|---|---|---|---|---|---|
| > 1 M | 543 | 88 % | 91 % | 79 % | **65 %** |
| 200 k – 1 M | 2410 | 61 % | 68 % | 44 % | **34 %** |
| 50 k – 200 k | 9068 | 54 % | 58 % | 39 % | **27 %** |
| 15 k – 50 k | 21394 | 34 % | 42 % | 23 % | **12 %** |

Matiz que la tabla esconde y que decide la respuesta: **para las lenguas en alfabeto
latino, no tener fila suele significar que el nombre es idéntico** (Madrid es Madrid en
alemán), así que un 79 % no es un 21 % de páginas rotas. Donde la ausencia SÍ se ve es en
`ru` —que es la mejor cubierta, 91 % en las grandes, precisamente porque el cirílico
obligó a rellenarlo— y sobre todo en `lt`, que declina y adapta los topónimos
(`Madridas`) y se queda en el 65 % incluso en megaciudades.

**Se mantiene la recomendación (a)**: endónimo latino con línea de procedencia. Pero el
esfuerzo de redacción va a `lt`, que es donde de verdad se lee a medio traducir.

**Q-3, Q-4, Q-5 — sin cambios.** Fuera de B, graduación manual, upsert en caliente. Q-1
refuerza las tres: con 1,38 M de URLs posibles, promover a curada tiene que seguir siendo
un acto humano.

**Dato que reencuadra el valor de B.** Sobre una muestra de 20.000 filas repartidas por
toda la tabla, el chip de PR A manda al índice al **35,4 %** de los casos — pero al
**50,9 %** de las ciudades de más de 500.000 habitantes. Falla MÁS cuanto más grande es
la ciudad, porque las grandes están repartidas por todo el mundo y las pequeñas se
agrupan donde ya hay built-ins. O sea que B no atiende a la cola larga: atiende
precisamente a lo que la gente busca.

---

## 8. Contrato de verificación de PR A

PR A está hecha cuando **todo** esto es cierto y está comprobado con su comando:

1. **El chip nunca desaparece.** Para cualquier `(cityId?, lat, lon)` finito,
   `directoryTarget` devuelve algo distinto de `null`; la rama `index` siempre tiene
   destino. Test unitario con las coordenadas de los casos extremos (Ushuaia, Nuuk,
   mitad del Pacífico).
2. **Cuando el destino no es la ciudad buscada y no es equivalente, el chip imprime
   los km**, y el entero impreso coincide con `Math.round(haversineKm(...))`. Test.
3. **El chip y el índice redondean igual**: la misma pareja de coordenadas produce el
   mismo entero en `CityPageLink` y en `CityIndexSearch`. Test.
4. **Un solo haversine.** `rg "6371"` sobre `lib/` y `components/` devuelve **una sola**
   definición, en `lib/geo-distance.ts`. `lib/geo-distance.ts` no tiene ningún `import`.
5. **`nearbyCities` produce exactamente la misma salida que antes del refactor**, para
   las 73 built-ins y `n = 5`, orden incluido. Test de snapshot.
6. **Las dos claves nuevas existen en los 6 ficheros de `messages/`.** Las cuatro
   locales pendientes pueden llevar el texto en inglés como marcador **si y solo si**
   la PR lo declara en su cuerpo como pendiente de traducción nativa. Lo que no puede
   pasar es que falte la clave: next-intl no lanza, renderiza el literal
   `cityPage.viewNearestCityPage` dentro de un HTML con 200.
7. **`app/sitemap.ts` sigue devolviendo 3.612 URLs** y `app/__tests__/sitemap.test.ts`
   pasa sin tocar.
8. **`CITY_PAGE_REVISION.date` no se ha movido**, y sí se han re-basado sus `parts`.
   `git diff lib/content-revision.ts` lo enseña en una pantalla.
9. **`rg "selectFromHeatmap|findNearestCity"` sobre `app/`, `components/`, `hooks/`,
   `context/`, `widgets/` y `lib/` no devuelve nada.**
10. `npm run typecheck` y `npm run lint` limpios.
11. `npm test -- --maxWorkers=2` verde. Si aparece
    `[vitest-pool]: Failed to start forks worker`, es saturación de la máquina, no un
    test roto: relanzar con menos workers antes de diagnosticar nada. El recuento
    válido de ficheros ejecutados es el de CI, no el local.
12. **Verificación humana en navegador antes del handoff**, en móvil real (390 px, vía
    `playwright-cli`, no el navegador MCP) y en las tres ramas: buscar Getafe
    (silenciosa), buscar Toledo (con km) y buscar Ushuaia (índice). Consola sin
    errores, chip legible y el tap target por encima de 44 px.

`npm run build` **no** entra en el contrato: PR A no toca ninguna ruta estática ni
ninguna configuración de segmento.
