# PR B — Página de ciudad bajo demanda · Plan de ejecución

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:executing-plans` (o
> `superpowers:subagent-driven-development`) para ejecutar este plan paso a paso.
> Los pasos usan checkbox (`- [ ]`). **Un paso = un commit.** TDD estricto:
> test-que-falla, implementación y test-que-pasa son pasos SEPARADOS con commits
> separados.

**Fecha:** 2026-08-26 · **Rama:** `feat/city-coverage` (ya creada, desde `origin/master` 5b2cf95).
**NO cambies de rama. NO toques `dev`.** `dev` está 22 commits por detrás de `master` y
`master` reestructuró esta misma zona: lee siempre el working tree actual.

**Objetivo:** que cualquier ciudad del buscador tenga su propia página de vitamina D en
`/{prefijo}/{slug}`, calculada con SU latitud, SU longitud, SU zona horaria IANA y SU
elevación — en vez de mandar al usuario a la ciudad curada más cercana. Sin arriesgar
nada del SEO que hoy funciona: la familia nueva entra `noindex, follow`, fuera del
sitemap y fuera de IndexNow.

**Spec (fuente de verdad):** `docs/superpowers/specs/2026-08-26-city-coverage-design.md`,
sección "PR B en detalle" (§5) y decisiones D-12 … D-17. Este plan no re-abre ninguna
decisión del spec; donde se desvía, lo dice y explica por qué.

**Estado de PR A:** implementada y presente en el working tree (sin commitear todavía o
ya commiteada, según cuándo se ejecute esto). Este plan **asume** que
`lib/geo-distance.ts`, `lib/nearest-city.ts` (con `nearestBuiltin`,
`EQUIVALENT_LAT_DEG`, `OFFER_LAT_DEG`, `NEARBY_PHRASING_KM`), `directoryTarget` en
`lib/city-client-links.ts` y las claves `cityPage.viewNearestCityPage` /
`cityPage.viewIndexInstead` ya existen. **Paso 1 lo verifica antes de nada.**

---

## Límites de la máquina — leer antes de ejecutar un solo comando

Esta máquina se satura y cuando lo hace **muere el proceso de Claude Code y se lleva por
delante el trabajo en curso**. Se han perdido tres tandas por esto.

- **Vitest SIEMPRE con `--maxWorkers=2`:** `npm test -- --maxWorkers=2`, o para un fichero
  suelto `npx vitest run <ruta> --maxWorkers=2`.
- Si aparece `[vitest-pool]: Failed to start forks worker — Timeout waiting for worker to
  respond`, **eso es saturación, no un test roto**: los ficheros afectados ni se ejecutan.
  Relanza con menos workers antes de diagnosticar nada.
- **Nunca dos suites completas a la vez**, ni una suite mientras corre otro proceso pesado.
- **Prefiere comprobaciones baratas**: leer el fichero, `rg`, un solo fichero de test.
  `npm run lint` y `npm run typecheck` son baratos — úsalos a menudo.
- **NO ejecutes `npm run build` ni `next build`** salvo en los dos pasos donde este plan lo
  autoriza explícitamente (Paso 4 y Paso 41). Tarda más de 2 minutos y es lo más pesado
  que existe aquí.
- **NUNCA uses `rtk next build`**: sirve un build cacheado y miente diciendo "0 errors".
  Usa `npx next build` directo.
- `npm test` local **ejecuta menos ficheros de los que hay** bajo carga y sale con éxito
  igualmente (se observó 37/51). El recuento válido es el de CI, no el local.

---

## Lo que ya está medido (2026-08-26) — no lo vuelvas a medir

| Magnitud | Valor |
|---|---|
| Filas reales en la tabla `cities` de Supabase | **230.407** (no 33.390) |
| Filas en `city_names` | 167.640 |
| Cobertura `city_names` es / en / fr | 24.687 (10,7 %) / 45.783 (19,9 %) / 27.648 (12,0 %) |
| Cobertura `city_names` de / ru / lt | 23.028 (10,0 %) / 41.112 (17,8 %) / **5.382 (2,3 %)** |
| Superficie de URLs si se sirviera todo | 230.407 × 6 = **1.382.442** |
| Slugs built-in distintos (`CITY_SLUGS`, 6 locales) | 194 |
| De esos 194, cuántos terminan en `-xx` | **0** (los dos espacios de nombres son disjuntos) |
| Ciudades con página curada | 73 → 438 rutas |
| Cupo ISR Hobby | 200.000 escrituras/mes; la ventana de 30 días cerró en 362.730 (181 %) |
| Search Console (28 días a 2026-08-12) | `vitamina-d`: 35 impresiones, 0 clics · `sunrise`: 34.761 impresiones, 99 de 101 clics |

**La corrección que cambia el orden de magnitud respecto del spec:** el spec §5.4 razona
sobre 33.390 ciudades y 200.340 URLs, porque asumía el dataset `cities15000` del fichero
local. La tabla real lleva `cities500` (`scripts/seed-cities.ts:14` descarga
`cities500.zip`) y tiene **230.407 filas**, o sea **1.382.442 URLs potenciales**. Eso NO
cambia ninguna decisión de diseño: la refuerza. Con la cifra optimista de 1 unidad de
escritura por página, rastrear esa superficie costaría **siete veces el cupo mensual**;
con la conservadora de 10, setenta veces. Es la justificación numérica de los cuatro
cerrojos (noindex, fuera del sitemap, fuera de IndexNow, sin malla dinámica-a-dinámica).

---

## Decisiones pendientes del usuario — CHECKPOINT 0, antes del Paso 1

Estas tres no las puede tomar un agente. **Si no están contestadas, para y pregunta.**

**Q-A · ¿Se sirve la tabla entera (230.407) o se acota por población?**
La opción de acotar sería `WHERE population >= 15000` en la RPC (≈33.000 filas, el
dataset que el spec asumía). Argumento para servir todo: con `noindex` + fuera del
sitemap + sin enlaces rastreables, el gasto lo acota el tráfico humano, no el recuento de
URLs, y acotar por población reintroduce exactamente el bug que B arregla para los
pueblos pequeños — que son justo los que hoy no tienen nada. Argumento para acotar: si
alguno de los cuatro cerrojos falla, el daño es 7× mayor.
**Recomendación: servir todo.** El coste está acotado por humanos; el recuento es ruido.

**Q-B (era Q-2 del spec) · ru y lt con el nombre en alfabeto latino.**
Ya medido: `city_names` cubre el 17,8 % en ru y el **2,3 %** en lt. Es decir, más del 80 %
de las páginas rusas y el 97,7 % de las lituanas llevarían el nombre de la ciudad en
grafía latina dentro de un texto en cirílico o en lituano.
*Opciones*: (a) aceptar el endónimo latino con una línea de procedencia; (b) no servir la
página dinámica en las locales sin traducción; (c) transliterar con el mapa cirílico de
`lib/city-slug.ts`.
**Recomendación: (a).** (b) rompe el hreflang y deja fuera a dos idiomas que el usuario ha
declarado personales; (c) inventa nombres. Este plan implementa (a) — con la clave
`cityPage.dynamicNameLatin` que lo dice en voz alta. Si el usuario elige (b) o (c), los
pasos 30-33 cambian.

**Q-C (era Q-5 del spec) · Re-sembrar `cities` en caliente o tabla nueva.**
La tabla sirve el buscador en producción. *Opciones*: (a) upsert por columnas, sin borrar;
(b) tabla nueva y swap atómico.
**Recomendación: (a).** El upsert solo añade dos columnas y no toca ninguna de las que el
buscador lee. Este plan implementa (a).

Q-3 (hubs y páginas mes para dinámicas) y Q-4 (política de graduación) del spec están
**fuera de alcance** y no bloquean: se deciden con B ya en producción.

---

## Mapa de ficheros

| Fichero | Qué le pasa |
|---|---|
| `supabase/migrations/20260826_city_slug_elevation.sql` | **NUEVO.** `cities.slug TEXT UNIQUE`, `cities.elevation SMALLINT`, RPC `city_by_slug`, RPC `city_by_geoname_id`, y recreación de `search_cities_localized` / `search_cities_nearby_localized` con las dos columnas nuevas. **Se aplica a mano ANTES de mergear.** |
| `lib/city-dynamic-slug.ts` | **NUEVO.** Módulo puro, cero imports: `dynamicCitySlug`, `isDynamicCitySlug`, `geonameIdFromAlias`, `aliasSlug`. Lo comparten la ruta y el script de siembra. |
| `lib/city-dynamic.ts` | **NUEVO.** `resolveDynamicCity(locale, slug)` con `cache()` de React, `dynamicCityPathname/Url/Alternates`. |
| `lib/builtin-geonames.ts` | **NUEVO (generado).** 73 `base` → `geoname_id`. Es lo que hace posible el 301 de la forma cualificada de una curada a su URL curada. |
| `scripts/dump-builtin-geonames.ts` | **NUEVO.** Genera el fichero anterior contra Supabase. |
| `scripts/slug-report.ts` | **NUEVO.** Dry-run offline de la asignación de slug sobre el volcado de GeoNames: cuenta colisiones y desempates sin tocar la base. |
| `scripts/seed-cities.ts` | Modificado: columna 16 (`dem`) → `elevation` (con `-9999` → null), slug inmutable, upsert por columnas. |
| `app/[locale]/[cityPrefix]/[city]/page.tsx` | Modificado: `resolveCity` async con rama dinámica y rama de redirección; `robots` solo en la dinámica; `revalidate = false` **se queda**; cercanas por coordenadas; cabecera reescrita. |
| `lib/city-nearby.ts` | Modificado: `nearbyCitiesTo(lat, lon, n)`; `nearbyCities(cityId)` pasa a ser un envoltorio fino con salida byte-idéntica. |
| `lib/types.ts` | `slug?: string` en `City`. |
| `lib/cities-api.ts` | `toCity` mapea `slug` y `elevation`; se unifica `ccToFlag`. |
| `lib/geonames.ts` | Importa `ccToFlag` de `lib/cc-flag.ts` en vez de duplicarlo. |
| `lib/cc-flag.ts` | **NUEVO.** La única `ccToFlag`. |
| `components/CityPageLink.tsx` | Rama nueva `dynamic`: enlaza al alias `id-{geonameid}` y nombra la ciudad **buscada**. |
| `lib/city-client-links.ts` | `DirectoryTarget` gana la variante `{ kind: "dynamic"; geonameId: number }`. |
| `app/[locale]/dashboard/page.tsx`, `app/[locale]/explore/page.tsx` | Una prop nueva al chip: `cityName`. |
| `messages/{es,en,fr,de,ru,lt}.json` | Dos claves nuevas en el namespace **`cityPage`** (no un namespace nuevo — ver Aviso 2). |
| `app/sitemap.ts` | La **salida no cambia** (3.612). Solo un párrafo de política en la cabecera. |
| `app/__tests__/sitemap.test.ts` | Mantiene el 3.612 y añade el assert de ausencia. |
| `lib/__tests__/indexnow.test.ts` | Assert de que el payload nunca lleva una URL de ciudad dinámica. |
| `lib/content-revision.ts` | Se re-basan los `parts`. **La fecha NO se mueve** (Aviso 1). |

---

## Cuatro avisos que van a morder si no se leen

**Aviso 1 · `CITY_PAGE_REVISION.date` no se mueve.**
`lib/__tests__/content-revision.test.ts` va a fallar en cuanto se toque `messages/*.json`
(namespace `cityPage`) o cualquiera de `CITY_PAGE_MODULES`. El test imprime un bloque
para pegar **con la fecha de hoy ya rellenada**. Pegarlo tal cual sería declarar contenido
nuevo en 438 URLs indexadas que **no ha cambiado**: las claves nuevas las renderiza solo la
rama dinámica y el chip, no las 438. **Instrucción vinculante: pegar los `parts` nuevos y
dejar `date` como estaba.** Es un cambio de instrumento, no de contenido.

**Aviso 2 · No añadas un namespace nuevo al fichero de ruta.**
`lib/__tests__/content-revision.test.ts:143-151` lee
`app/[locale]/[cityPrefix]/[city]/page.tsx`, extrae con regex todos los
`namespace: "..."` y exige que el conjunto sea exactamente `CITY_PAGE_NAMESPACES`
(`["cityPage", "sunTimes"]`). Si metes `getTranslations({..., namespace: "cityDynamic"})`
en ese fichero, ese test se pone rojo. **Las claves nuevas van dentro de `cityPage`.**

**Aviso 3 · Cambiar el `RETURNS TABLE` de una función existente exige DROP.**
Postgres no permite cambiar el tipo de retorno con `CREATE OR REPLACE`. Para añadir `slug`
y `elevation` a `search_cities_localized` y a `search_cities_nearby_localized` hay que
`DROP FUNCTION IF EXISTS ... ;` primero, con la firma completa. Entre el DROP y el CREATE
hay una ventana de milisegundos en la que `/api/cities` cae a su fallback no localizado
(`app/api/cities/route.ts:56-81` y `:96-110`) — degradación, no caída. Aplicar la
migración entera en una sola ejecución del SQL editor.

**Aviso 4 · `lib/city-nearby.ts` decide contenido de 3.558 páginas.**
No está en `CITY_PAGE_MODULES` ni en `SUN_MONTH_MODULES` de
`lib/content-fingerprint.ts`, pero el **orden** de sus enlaces es contenido publicado en
438 páginas de ciudad + 2.880 páginas mes + 240 hubs. Si el refactor cambia el orden o el
`n`, se publica contenido nuevo en páginas que el sitemap declara sin cambios. El baseline
ya existe: `lib/__tests__/city-nearby-baseline.test.ts` y
`lib/__tests__/fixtures/nearby-cities-baseline.json`. **Ese test tiene que seguir verde sin
tocar el fixture.**

---

# FASE 0 — Verificación de partida y mediciones (Pasos 1-5)

### Paso 1: Verificar que la base de PR A está en el árbol

- [ ] **Paso 1 (sin commit)**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
git branch --show-current                      # debe imprimir: feat/city-coverage
rg -n "export function nearestBuiltin" lib/nearest-city.ts
rg -n "export function directoryTarget" lib/city-client-links.ts
rg -n "viewNearestCityPage|viewIndexInstead" messages/es.json
rg -c "6371" lib/ components/                  # una sola definición, en lib/geo-distance.ts
```

**Hecho cuando:** las tres primeras búsquedas devuelven una línea cada una y `6371` sale
solo en `lib/geo-distance.ts`. **Si falta algo, PARA**: PR A no está en el árbol y este
plan no se puede ejecutar encima.

---

### Paso 2: Confirmar el tamaño de `cities` y la cobertura de `city_names`

- [ ] **Paso 2 (sin commit)**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
set -a && . ./.env.local && set +a && node -e "
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {count}=await sb.from('cities').select('*',{count:'exact',head:true});
  console.log('cities:',count);
  for (const l of ['es','en','fr','de','ru','lt']) {
    const {count:c}=await sb.from('city_names').select('*',{count:'exact',head:true}).eq('locale',l);
    console.log(l,c);
  }
})();"
```

**Valores esperados (medidos el 2026-08-26):** `cities: 230407`; `es 24687`, `en 45783`,
`fr 27648`, `de 23028`, `ru 41112`, `lt 5382`.

**Hecho cuando:** los números salen dentro de un ±2 % de esos. Si `cities` sale por debajo
de 40.000, la tabla se ha re-sembrado con `cities15000` desde entonces: anótalo y sigue —
el diseño no cambia, solo el párrafo de coste del cuerpo de la PR.

---

### Paso 3: Dry-run offline de la asignación de slug

- [ ] **Paso 3 — crear `scripts/slug-report.ts` y ejecutarlo · commit**

Crea `scripts/slug-report.ts`. Descarga el mismo volcado que `scripts/seed-cities.ts`
(`http://download.geonames.org/export/dump/cities500.zip`), lo parsea igual (tab, columnas
0=geonameid, 2=asciiname, 8=country_code, 14=population, 16=dem) y **no toca la base de
datos**. Asigna los slugs con exactamente el mismo algoritmo que usará la siembra:

1. Ordenar por `population DESC`, y a igualdad por `geoname_id ASC`. (Determinista e
   independiente del orden del fichero.)
2. `candidato = slugify(ascii_name) + "-" + country_code.toLowerCase()`.
3. Si `candidato` ya está tomado → `candidato + "-" + geoname_id`.

`slugify` es el de `lib/city-slug.ts` (import directo, no lo reimplementes).

El script imprime:

```
filas totales:                N
slugs cortos (nombre-cc):     N
slugs con desempate (-id):    N   (X,X %)
top 10 grupos en colisión:    springfield-us=8, ...
slugs que chocan con CITY_SLUGS: N   <-- tiene que ser 0
```

El último recuento se calcula contra los 194 valores distintos de
`lib/city-slugs.ts` (todas las locales).

Ejecuta:

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx tsx scripts/slug-report.ts
```

**Hecho cuando:** el script imprime el informe y `slugs que chocan con CITY_SLUGS` es
**0**. Si no es 0, PARA: el supuesto de espacios de nombres disjuntos (D-12) es falso para
el dataset real y hay que rediseñar el esquema de URL antes de seguir.

**Commit:** `chore(cities): dry-run report of the dynamic slug assignment`

---

### Paso 4: Medir si Next cachea el `notFound()` de un parámetro no listado

Esta es **la trampa** que el spec §5.4 manda medir y no suponer: si el 404 de un slug
arbitrario se escribe en el full route cache, cualquiera desde fuera puede provocar
escrituras ISR ilimitadas contra un cupo que ya está al 181 %.

- [ ] **Paso 4 (sin commit) — ÚNICO build autorizado antes del final**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx next build          # >2 min. Lánzalo en segundo plano y espera. NUNCA `rtk next build`.
npx next start -p 3210  # en otra terminal / segundo plano
```

Con el servidor arriba:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/vitamina-d/zzzz-aaaa-0001
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/vitamina-d/zzzz-aaaa-0002
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/vitamina-d/zzzz-aaaa-0003
ls -R .next/server/app/\[locale\]/\[cityPrefix\]/ | rg -i "zzzz" || echo "NO SE CACHEA"
find .next -name "*zzzz*" | head
```

## MEDIDO EL 2026-08-26 — este paso ya está hecho, y su respuesta invalida el «Plan B»

Next **16.1.6 SÍ cachea** el `notFound()` de un parámetro no listado. Medido sobre una app
mínima con seis variantes de configuración de segmento, servida con `next start`:

```
curl -sD - .../es/vitamina-d/zzzz-aaaa-0001
  HTTP/1.1 404 · x-nextjs-cache: MISS · x-nextjs-prerender: 1
  x-nextjs-stale-time: 300 · Cache-Control: s-maxage=31536000
segunda petición a la misma URL → x-nextjs-cache: HIT
en disco: 11 ficheros (.html + .rsc + .meta + 8 .segment.rsc) = 19.613 bytes por URL basura
```

**El «Plan B» de este paso NO FUNCIONA. No lo intentes.** `import { connection } from
"next/server"; await connection(); notFound();` devuelve **HTTP 500** con
`digest: 'DYNAMIC_SERVER_USAGE'`, no un 404, tanto con `revalidate = false` como sin ese
export. Next renderiza los params no listados en modo generación estática para rellenar la
caché, y una API dinámica ahí es un error, no una vía de escape.

**Las dos salidas baratas también están descartadas**, medidas: sin ningún `revalidate` el
404 se cachea igual, y con `dynamicParams = false` también (11 ficheros, 19.557 bytes). No
lo causa `revalidate = false`.

**Lo único que evita la escritura es `export const dynamic = "force-dynamic"`** — 404 con
`Cache-Control: private, no-cache, no-store` y cero ficheros en disco. Pero es POR FICHERO
y arrastra todo lo demás: esa variante se construyó como `f (Dynamic)` sin prerenderizar
ninguno de sus `generateStaticParams`. Ponerlo en el fichero real sacaría del prerender a
las 438 páginas curadas. **No es opción para el fichero compartido.**

**Consecuencia vinculante para el Paso 32:** un solo fichero de ruta no puede ser a la vez
estático para las 438 curadas y no-cacheado en el fallo. Es una decisión de arquitectura de
rutas, no una línea de código. La opción recomendada es **partir por reescritura en
`proxy.ts`**: el middleware aplica `isDynamicCitySlug` y reescribe las URLs que casan a un
fichero de ruta interno aparte con `dynamic = "force-dynamic"`. Las curadas no casan nunca
—medido: 0 de 194 slugs built-in terminan en dos letras tras guion— así que el fichero
estático y sus 438 páginas quedan intactos y la URL pública no cambia.

**Dos matices que hay que decir en la PR para no atribuir a B un problema heredado:**

1. **La exposición ya existe hoy en producción.** El fichero real es exactamente la
   variante medida (`revalidate = false` + `notFound()` pelado), así que
   `/vitamina-d/<cualquier-basura>` ya escribe hoy un 404 cacheado. B no abre el agujero;
   ensancha su superficie. Y conviene mirarlo del revés: con el cupo ISR al **181 %**
   (362.730 de 200.000, `CLAUDE.md` línea 173), los 404 basura cacheados son un sospechoso
   de esa cifra que nadie había conectado.
2. **El prefiltro sintáctico NO protege el cupo ISR**, solo la base de datos. Este paso
   daba a entender lo contrario. `isDynamicCitySlug` ahorra la consulta a Supabase, pero su
   rama de rechazo termina igualmente en `notFound()`, que se cachea igual.

**Caveat de fidelidad:** medido con `next start` autoalojado, o sea contra la caché de
sistema de ficheros. Las cabeceras y los cache tags son los que consume la capa ISR de
Vercel, así que la conclusión cualitativa transfiere; la conversión de bytes a unidades de
escritura es inferencia a partir de la unidad de 8 KB, no está medida en Vercel. A favor:
el `.meta` lleva un cache tag por URL, así que un 404 envenenado se purga con
`revalidatePath` sin desplegar.

---

### Paso 5: CHECKPOINT HUMANO 1

- [ ] **Paso 5 — parar y enseñar**

Enseña al usuario, en tres líneas:
1. el recuento real de `cities` y la cobertura por locale (Paso 2);
2. el informe de slugs: cuántos desempates y cero colisiones con las curadas (Paso 3);
3. si Next cachea o no el 404, y qué implica (Paso 4).

Y pide las tres decisiones **Q-A, Q-B y Q-C** de la cabecera de este plan si no estaban
contestadas ya. **No sigas al Paso 6 sin respuesta.**

---

# FASE 1 — Base de datos (Pasos 6-14)

### Paso 6: Test que falla — el módulo de slug

- [ ] **Paso 6 · commit**

Crea `lib/__tests__/city-dynamic-slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  dynamicCitySlug, isDynamicCitySlug, aliasSlug, geonameIdFromAlias,
} from "@/lib/city-dynamic-slug";
import { CITY_SLUGS } from "@/lib/city-slugs";

describe("dynamicCitySlug", () => {
  it("qualifies every slug by country, always — not only on collision", () => {
    expect(dynamicCitySlug("Toledo", "ES")).toBe("toledo-es");
    expect(dynamicCitySlug("Toledo", "US")).toBe("toledo-us");
  });

  it("lowercases the country code and slugifies the ascii name", () => {
    expect(dynamicCitySlug("Ravensburg", "de")).toBe("ravensburg-de");
    expect(dynamicCitySlug("Sao Joao da Boa Vista", "BR")).toBe("sao-joao-da-boa-vista-br");
  });

  it("appends the geoname id when a tiebreak is required", () => {
    expect(dynamicCitySlug("Springfield", "US", 4951788)).toBe("springfield-us-4951788");
  });

  it("is a pure function of its arguments — same input, same slug, always", () => {
    expect(dynamicCitySlug("Toledo", "ES")).toBe(dynamicCitySlug("Toledo", "ES"));
  });
});

describe("isDynamicCitySlug — the syntactic prefilter that runs before touching the DB", () => {
  it("accepts the qualified and the tiebroken forms", () => {
    expect(isDynamicCitySlug("toledo-es")).toBe(true);
    expect(isDynamicCitySlug("springfield-us-4951788")).toBe(true);
  });

  it("rejects garbage without a country qualifier", () => {
    for (const s of ["aaaa", "madrid", "", "-", "a", "toledo-", "toledo-e", "toledo-esp"]) {
      expect(isDynamicCitySlug(s), s).toBe(false);
    }
  });

  it("rejects anything outside [a-z0-9-]", () => {
    for (const s of ["Toledo-es", "toledo_es", "толедо-ru", "toledo es", "toledo-es/../x"]) {
      expect(isDynamicCitySlug(s), s).toBe(false);
    }
  });

  /**
   * D-12's load-bearing claim, pinned: the two namespaces are disjoint by
   * construction, so a dynamic slug can never shadow a curated page. Measured
   * 2026-08-26: 194 distinct builtin slugs, zero ending in `-xx`.
   */
  it("never matches a curated slug, in any locale", () => {
    const all = new Set<string>();
    for (const base of Object.keys(CITY_SLUGS)) {
      for (const locale of Object.keys(CITY_SLUGS[base])) all.add(CITY_SLUGS[base][locale]);
    }
    expect(all.size).toBe(194);
    for (const slug of all) expect(isDynamicCitySlug(slug), slug).toBe(false);
  });
});

describe("the id alias — for the client that only holds a geoname id", () => {
  it("round-trips", () => {
    expect(aliasSlug(2519240)).toBe("id-2519240");
    expect(geonameIdFromAlias("id-2519240")).toBe(2519240);
  });

  it("returns null for anything that is not the alias form", () => {
    for (const s of ["toledo-es", "id-", "id-abc", "id-12.5", "id--1", ""]) {
      expect(geonameIdFromAlias(s), s).toBeNull();
    }
  });
});
```

Ejecuta y **observa que falla**:

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/city-dynamic-slug.test.ts --maxWorkers=2
```

**Hecho cuando:** falla con `Failed to resolve import "@/lib/city-dynamic-slug"`.

**Commit:** `test(city-dynamic): pin the qualified slug, the prefilter and the id alias`

---

### Paso 7: Implementar `lib/city-dynamic-slug.ts`

- [ ] **Paso 7 · commit**

Crea `lib/city-dynamic-slug.ts`. Único import permitido: `slugify` de `./city-slug`
(cero dependencias de red, de Supabase o de mensajes — lo importan tanto la ruta como el
script de siembra que corre bajo `tsx` fuera de Next).

```ts
import { slugify } from "./city-slug";

/**
 * THE URL SHAPE OF THE ON-DEMAND CITY PAGES, and the one place it is decided.
 *
 * `/{CITY_PREFIX[locale]}/{slug}` with `slug = slugify(ascii_name)-{cc}`, plus
 * `-{geonameid}` when that pair is already taken. Only the prefix is localized;
 * the slug is NOT (D-12). For the long tail the GeoNames ASCII name is what
 * people type, localizing it would multiply by six a surface that is going
 * `noindex` anyway, and it removes a whole class of cross-locale collisions.
 *
 * QUALIFY ALWAYS, NOT ONLY ON COLLISION. If `toledo` were the URL while no
 * second Toledo existed, the URL would depend on a mutable dataset: the next
 * GeoNames release adds one and yesterday's URL has to move. Qualifying
 * unconditionally makes the slug a pure function of (name, country).
 *
 * DISJOINT FROM THE CURATED NAMESPACE, measured not assumed: of the 194 distinct
 * builtin slugs across the six locales, ZERO end in `-xx`. `SLUG_TO_ID`
 * (lib/city-routes.ts) is consulted FIRST and always wins.
 */
export function dynamicCitySlug(asciiName: string, cc: string, tiebreakId?: number): string {
  const base = `${slugify(asciiName)}-${cc.toLowerCase()}`;
  return tiebreakId === undefined ? base : `${base}-${tiebreakId}`;
}

/**
 * The syntactic prefilter, run BEFORE any database round trip. It throws away
 * most garbage for free, which matters because a miss may cost an ISR cache
 * write on a plan whose write quota is already exceeded (see the plan's Paso 4).
 */
const DYNAMIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z]{2}(?:-\d+)?$/;

export function isDynamicCitySlug(slug: string): boolean {
  return DYNAMIC_SLUG_RE.test(slug);
}

/** `id-2519240` — the form a client that only holds a geoname id can build. */
export function aliasSlug(geonameId: number): string {
  return `id-${geonameId}`;
}

/** The geoname id inside an alias slug, or null when it is not one. */
export function geonameIdFromAlias(slug: string): number | null {
  const m = /^id-(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}
```

Nota sobre la regex: es más estricta que la `^[a-z0-9-]+-[a-z]{2}(-\d+)?$` del spec —
prohíbe guiones dobles y guiones al principio o al final, que `slugify` nunca produce.
Ninguna URL válida se pierde y desaparece una clase de basura.

**Hecho cuando:** el fichero existe y `npm run typecheck` está limpio.

**Commit:** `feat(city-dynamic): the qualified slug, the prefilter and the id alias`

---

### Paso 8: Test que pasa

- [ ] **Paso 8 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/city-dynamic-slug.test.ts --maxWorkers=2
```

**Hecho cuando:** los 4 bloques verdes, incluido `expect(all.size).toBe(194)`.

**Commit:** `test(city-dynamic): slug module green`

---

### Paso 9: La migración SQL

- [ ] **Paso 9 · commit**

Crea `supabase/migrations/20260826_city_slug_elevation.sql`:

```sql
-- Migration: stable slug + elevation on `cities`, and the RPCs the on-demand
-- city pages resolve through.
--
-- WHY THE SLUG IS A COLUMN AND NOT A DERIVATION. It is assigned ONCE, at seed
-- time, and never recomputed: first one in keeps the short `name-cc` form, the
-- rest get `-{geonameid}`. Stability is then a property of the database, not of
-- a derivation that depends on population order — which GeoNames does revise.
-- Recomputing per request would move URLs that are already published.
--
-- WHY ELEVATION IS BLOCKING (D-14). `lib/city-content.ts` defaults to
-- elevationM = 0, i.e. sea level for every non-curated city. Measured with the
-- repo's own model (UVI_ALTITUDE_GAIN_PER_KM = 0.08): of the 73 builtin cities,
-- FIVE change their month count just by zeroing their elevation (Edinburgh 5->6
-- at 47 m, Moscow 5->6 at 150 m, Phoenix 11->12, Sydney 11->12, Vancouver 6->7);
-- at 1500 m, 25 of 73 change. Publishing Bogota (2640 m), Cusco (3399 m), Mexico
-- City or Denver at sea level would print a wrong headline.
--
-- APPLY THIS BY HAND, IN ONE GO, BEFORE MERGING (see CLAUDE.md, "Supabase
-- migrations"): the deploy on merge is automatic, so the DB must be ready first.

-- 1. The two new columns. `elevation` is nullable on purpose: GeoNames uses
--    -9999 in the `dem` column for "no data", and a null that the code can fall
--    back from is honest where a 0 would be a claim about sea level.
ALTER TABLE cities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS elevation SMALLINT;

-- UNIQUE, not just indexed: the tiebreak rule is only meaningful if the database
-- refuses a duplicate. A partial index skips the rows not yet seeded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_slug ON cities (slug) WHERE slug IS NOT NULL;

-- 2. Resolution by slug. One indexed lookup, plus the localized display name via
--    the same LEFT JOIN pattern `search_cities_localized` already uses.
--    country_code is CHAR(2) in the table and TEXT here, so it is cast
--    explicitly rather than relying on an implicit coercion.
CREATE OR REPLACE FUNCTION city_by_slug(p_slug TEXT, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  elevation SMALLINT,
  slug TEXT,
  display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.slug = p_slug
  LIMIT 1;
$$;

-- 3. Resolution by geoname id — the `/{prefix}/id-{geonameid}` alias, which the
--    route answers with a 301 to the canonical slug. It exists for the client
--    that only holds the id: the local fallback in lib/geonames.ts and the MCP
--    tools, neither of which knows the slug map.
CREATE OR REPLACE FUNCTION city_by_geoname_id(p_geoname_id INTEGER, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  elevation SMALLINT,
  slug TEXT,
  display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.geoname_id = p_geoname_id
  LIMIT 1;
$$;

-- 4. The two search RPCs gain `slug` and `elevation`. Postgres cannot change a
--    function's return type with CREATE OR REPLACE, so each is dropped first.
--    Between the DROP and the CREATE, /api/cities degrades to its non-localized
--    fallback — which is why this file is applied in a single execution.
DROP FUNCTION IF EXISTS search_cities_localized(TEXT, TEXT, INTEGER);

CREATE FUNCTION search_cities_localized(
  p_query TEXT,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  geoname_id INTEGER, name TEXT, ascii_name TEXT, country_code TEXT,
  lat REAL, lon REAL, population INTEGER, timezone TEXT,
  elevation SMALLINT, slug TEXT, display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.ascii_name ILIKE ('%' || p_query || '%')
     OR cn.name ILIKE ('%' || p_query || '%')
  ORDER BY c.population DESC
  LIMIT p_limit;
$$;

DROP FUNCTION IF EXISTS search_cities_nearby_localized(REAL, REAL, TEXT, INTEGER);

CREATE FUNCTION search_cities_nearby_localized(
  p_lat REAL,
  p_lon REAL,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  geoname_id INTEGER, name TEXT, ascii_name TEXT, country_code TEXT,
  lat REAL, lon REAL, population INTEGER, timezone TEXT,
  elevation SMALLINT, slug TEXT, display_name TEXT, distance REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name,
    sqrt(power(c.lat - p_lat, 2) + power(c.lon - p_lon, 2)) AS distance
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  ORDER BY distance
  LIMIT p_limit;
$$;
```

**Lo que esta migración NO hace, a propósito:** no arregla el `distance` euclídeo-en-grados
de `search_cities_nearby_localized`. Está declarado FUERA de alcance en el spec §2 porque
además de etiquetar **cambia el cálculo** para usuarios nórdicos, canadienses y rusos, y
lleva PR propia. Se copia tal cual estaba.

**Hecho cuando:** el fichero existe. No se aplica todavía.

**Commit:** `feat(db): migration for cities.slug, cities.elevation and the on-demand RPCs`

---

### Paso 10: Test que falla — la siembra asigna slug y elevación

- [ ] **Paso 10 · commit**

Crea `scripts/__tests__/seed-slug-assignment.test.ts`. La lógica pura de asignación se
extrae del script a una función exportada para poder testearla sin red:

```ts
import { describe, it, expect } from "vitest";
import { assignSlugs, parseElevation, type SeedRow } from "@/scripts/seed-cities";

const row = (geoname_id: number, ascii_name: string, cc: string, population: number): SeedRow => ({
  geoname_id, name: ascii_name, ascii_name, country_code: cc,
  lat: 0, lon: 0, population, timezone: "UTC", elevation: null,
});

describe("assignSlugs", () => {
  it("gives the short form to the most populated of a colliding group", () => {
    const out = assignSlugs([
      row(2, "Springfield", "US", 100),
      row(1, "Springfield", "US", 500),
    ], new Set());
    expect(out.find((r) => r.geoname_id === 1)!.slug).toBe("springfield-us");
    expect(out.find((r) => r.geoname_id === 2)!.slug).toBe("springfield-us-2");
  });

  it("breaks a population tie by geoname id, so the result never depends on file order", () => {
    const a = assignSlugs([row(9, "Ávila", "ES", 10), row(4, "Avila", "ES", 10)], new Set());
    const b = assignSlugs([row(4, "Avila", "ES", 10), row(9, "Ávila", "ES", 10)], new Set());
    expect(a.find((r) => r.geoname_id === 4)!.slug).toBe("avila-es");
    expect(b.find((r) => r.geoname_id === 4)!.slug).toBe("avila-es");
  });

  it("never reassigns a slug that the database already holds", () => {
    const out = assignSlugs([row(1, "Toledo", "ES", 900)], new Set(["toledo-es"]));
    expect(out[0].slug).toBe("toledo-es-1");
  });

  it("keeps different countries apart without a tiebreak", () => {
    const out = assignSlugs([row(1, "Toledo", "ES", 900), row(2, "Toledo", "US", 800)], new Set());
    expect(out.map((r) => r.slug).sort()).toEqual(["toledo-es", "toledo-us"]);
  });
});

describe("parseElevation — GeoNames column 16 (dem)", () => {
  it("reads a real elevation", () => {
    expect(parseElevation("2640")).toBe(2640);
    expect(parseElevation("-2")).toBe(-2);
  });

  /**
   * -9999 is GeoNames' "no data" marker, not a place 10 km below the sea. Storing
   * it would feed UVI_ALTITUDE_GAIN_PER_KM a number eight hundred times wrong.
   */
  it("maps the no-data marker and empty values to null", () => {
    expect(parseElevation("-9999")).toBeNull();
    expect(parseElevation("")).toBeNull();
    expect(parseElevation("abc")).toBeNull();
  });

  /** SMALLINT is -32768..32767; nothing on Earth is outside it, but a corrupt row could be. */
  it("rejects anything outside SMALLINT range", () => {
    expect(parseElevation("40000")).toBeNull();
  });
});
```

Comprueba primero que `vitest.config.ts` incluye `scripts/__tests__` en su `include`; si
no, añádelo en ese mismo commit (`scripts/__tests__/**/*.test.ts`) — el fichero ya tiene
otras rutas de test enumeradas.

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run scripts/__tests__/seed-slug-assignment.test.ts --maxWorkers=2
```

**Hecho cuando:** falla porque `assignSlugs` y `parseElevation` no se exportan.

**Commit:** `test(seed): pin the immutable slug assignment and the dem parsing`

---

### Paso 11: Implementar los cambios de `scripts/seed-cities.ts`

- [ ] **Paso 11 · commit**

Modifica `scripts/seed-cities.ts`:

1. `CityRow` gana `elevation: number | null` y `slug?: string`; exporta el tipo como
   `SeedRow`.
2. Parseo: `elevation: parseElevation(cols[16])`. **Columna 16 (`dem`), no la 15
   (`elevation`)**: la 15 suele venir vacía, la 16 siempre viene rellena.
3. Exporta `parseElevation(raw: string): number | null` — `-9999`, vacío, no numérico o
   fuera de `[-32768, 32767]` → `null`.
4. Exporta `assignSlugs(rows: SeedRow[], taken: Set<string>): SeedRow[]`: ordena una copia
   por `population DESC, geoname_id ASC`, y para cada fila usa `dynamicCitySlug(ascii_name,
   country_code)`; si ya está en `taken`, `dynamicCitySlug(ascii_name, country_code,
   geoname_id)`. Añade cada slug asignado a `taken`. Devuelve las filas **en el orden
   original**, cada una con su `slug`.
5. Antes de sembrar, carga los slugs que la base ya tiene y **no los reasigna**:

```ts
// The slug is assigned ONCE and never recomputed. Rows that already carry one
// keep it: their URL may already be published, and a slug that moves is a 404
// on a page that had accumulated whatever little authority it had.
const taken = new Set<string>();
const existing = new Map<number, string>();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("cities").select("geoname_id, slug").not("slug", "is", null)
    .range(from, from + 999);
  if (error) throw new Error(`reading existing slugs: ${error.message}`);
  if (!data || data.length === 0) break;
  for (const r of data) { taken.add(r.slug as string); existing.set(r.geoname_id, r.slug as string); }
  if (data.length < 1000) break;
}
console.log(`existing slugs preserved: ${taken.size}`);
```

y en la asignación, una fila con `existing.get(geoname_id)` conserva ese valor.

6. **Upsert por columnas (decisión Q-C(a), en caliente).** El upsert sigue con
   `onConflict: "geoname_id"`, y **manda el objeto completo** — `name`, `lat`, `lon`,
   `population`, `timezone` son los mismos valores del mismo volcado, así que no hay
   pérdida. Lo único que nunca se sobreescribe es un `slug` ya existente, garantizado por
   el punto 5.
7. `--dry-run`: si `process.argv.includes("--dry-run")`, imprime el resumen (filas, slugs
   nuevos, slugs preservados, elevaciones nulas) y **sale sin escribir**.

**Hecho cuando:** `npm run typecheck` limpio y `npm run lint` limpio.

**Commit:** `feat(seed): immutable slug and dem-derived elevation for the cities table`

---

### Paso 12: Test que pasa

- [ ] **Paso 12 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run scripts/__tests__/seed-slug-assignment.test.ts --maxWorkers=2
```

**Hecho cuando:** verde.

**Commit:** `test(seed): slug assignment green`

---

### Paso 13: CHECKPOINT HUMANO 2 — aplicar la migración a mano

- [ ] **Paso 13 (sin commit)**

`supabase/migrations/*.sql` **no se aplican solos** y el deploy al mergear sí es
automático: la base tiene que estar lista antes de que el código aterrice.

Pide al usuario que ejecute
`supabase/migrations/20260826_city_slug_elevation.sql` **entero, de una sola vez**, en el
SQL editor del proyecto Supabase compartido. Después verifica desde aquí:

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
set -a && . ./.env.local && set +a && node -e "
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {data,error}=await sb.from('cities').select('geoname_id,slug,elevation').limit(1);
  console.log('columnas:', error ? error.message : Object.keys(data[0]).join(','));
  const r=await sb.rpc('city_by_slug',{p_slug:'__nope__',p_locale:'es'});
  console.log('city_by_slug:', r.error ? r.error.message : 'OK (0 filas)');
  const r2=await sb.rpc('city_by_geoname_id',{p_geoname_id:-1,p_locale:'es'});
  console.log('city_by_geoname_id:', r2.error ? r2.error.message : 'OK (0 filas)');
  const r3=await sb.rpc('search_cities_localized',{p_query:'madrid',p_locale:'es',p_limit:1});
  console.log('search_cities_localized:', r3.error ? r3.error.message : Object.keys(r3.data[0]).join(','));
})();"
```

**Hecho cuando:** `columnas` incluye `slug` y `elevation`; las dos RPC nuevas responden sin
error; `search_cities_localized` devuelve una fila que ya incluye `slug` y `elevation`.

---

### Paso 14: CHECKPOINT HUMANO 3 — la re-siembra

- [ ] **Paso 14 (sin commit)**

Primero el ensayo, que no escribe:

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
set -a && . ./.env.local && set +a && npx tsx scripts/seed-cities.ts --dry-run
```

Enseña al usuario el resumen (filas, slugs nuevos, preservados, elevaciones nulas) y pide
el visto bueno **antes** de la escritura real. Es la tabla que sirve el buscador en
producción. Luego:

```bash
set -a && . ./.env.local && set +a && npx tsx scripts/seed-cities.ts
```

Verifica:

```bash
set -a && . ./.env.local && set +a && node -e "
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {count:total}=await sb.from('cities').select('*',{count:'exact',head:true});
  const {count:withSlug}=await sb.from('cities').select('*',{count:'exact',head:true}).not('slug','is',null);
  const {count:withElev}=await sb.from('cities').select('*',{count:'exact',head:true}).not('elevation','is',null);
  console.log('total',total,'con slug',withSlug,'con elevacion',withElev);
  for (const s of ['toledo-es','bogota-co','cusco-pe']) {
    const {data}=await sb.rpc('city_by_slug',{p_slug:s,p_locale:'es'});
    console.log(s, JSON.stringify(data?.[0] ?? null));
  }
})();"
```

**Hecho cuando:** `con slug` == `total`; `con elevacion` está por encima del 95 % de
`total`; y `bogota-co` devuelve una elevación en torno a 2.640, no 0 ni null. Si Bogotá
sale a nivel del mar, la columna parseada es la equivocada (15 en vez de 16): arregla y
re-siembra antes de seguir.

---

# FASE 2 — Resolución (Pasos 15-24)

### Paso 15: Generar el mapa `base → geoname_id` de las 73 curadas

- [ ] **Paso 15 · commit**

Este mapa es lo que hace verdad la regla "una ciudad, una URL": sin él, `/vitamina-d/
edinburgh-gb` serviría una segunda página de Edimburgo compitiendo con `/vitamina-d/
edimburgo`. No se puede derivar del slug (los nombres difieren por locale) ni de las
coordenadas (Getafe está a 15 km de Madrid y no es Madrid), así que es un mapa explícito
y auditado.

Crea `scripts/dump-builtin-geonames.ts`: para cada una de las 73 de `BUILTIN_CITIES`,
consulta Supabase por proximidad (`search_cities_nearby` con `p_limit: 5`) sobre su
`lat`/`lon`, elige la fila cuyo `ascii_name` slugificado coincida con alguno de los seis
slugs de esa ciudad en `CITY_SLUGS` **y** esté a menos de 25 km, e imprime el módulo
`lib/builtin-geonames.ts`:

```ts
// GENERATED by scripts/dump-builtin-geonames.ts — do not edit by hand.
//
// The GeoNames id of each curated city. It is what lets the route answer 301 to
// the curated URL when someone asks for that city's QUALIFIED form
// (`/vitamina-d/shanghai-cn` -> `/vitamina-d/shanghai`), so one city never has
// two pages. Verified against coordinates in lib/__tests__/builtin-geonames.test.ts.
export const BUILTIN_GEONAME_ID: Record<string, number> = { ... };
```

Ejecuta:

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
set -a && . ./.env.local && set +a && npx tsx scripts/dump-builtin-geonames.ts > lib/builtin-geonames.ts
```

Si alguna de las 73 no resuelve, el script lo imprime por `stderr` con el nombre; resuélvela
a mano buscando por nombre en la tabla y añádela. **No dejes ninguna fuera en silencio.**

**Hecho cuando:** `lib/builtin-geonames.ts` tiene 73 entradas y `npm run typecheck` limpio.

**Commit:** `feat(cities): map the 73 curated cities to their GeoNames ids`

---

### Paso 16: Test que falla — el mapa de curadas es correcto

- [ ] **Paso 16 · commit**

Crea `lib/__tests__/builtin-geonames.test.ts`: comprueba que hay exactamente 73 entradas,
que cada clave es un `baseSlug` de `BUILTIN_CITIES`, que no hay ids repetidos, y —el
assert que de verdad importa— que **no falta ninguna**:

```ts
import { describe, it, expect } from "vitest";
import { BUILTIN_GEONAME_ID } from "@/lib/builtin-geonames";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug } from "@/lib/city-routes";

describe("BUILTIN_GEONAME_ID", () => {
  it("covers every curated city, with no extras", () => {
    const bases = BUILTIN_CITIES.map((c) => baseSlug(c.id)).sort();
    expect(Object.keys(BUILTIN_GEONAME_ID).sort()).toEqual(bases);
  });

  it("has no duplicate ids — two curated cities cannot be the same place", () => {
    const ids = Object.values(BUILTIN_GEONAME_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("holds plausible GeoNames ids", () => {
    for (const [base, id] of Object.entries(BUILTIN_GEONAME_ID)) {
      expect(Number.isInteger(id), base).toBe(true);
      expect(id, base).toBeGreaterThan(0);
    }
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/builtin-geonames.test.ts --maxWorkers=2
```

**Hecho cuando:** verde a la primera si el Paso 15 salió bien; si falla, el que está mal es
el mapa, no el test — arregla el mapa.

**Commit:** `test(cities): pin the curated-to-GeoNames map`

---

### Paso 17: Test que falla — `resolveDynamicCity`

- [ ] **Paso 17 · commit**

Crea `lib/__tests__/city-dynamic.test.ts`. El cliente de Supabase se mockea con
`vi.mock("@/lib/supabase")`, así el test no toca la red:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }) }));

import {
  resolveDynamicCity, dynamicCityPathname, dynamicCityUrl, buildDynamicCityAlternates,
} from "@/lib/city-dynamic";
import { SITE_URL } from "@/lib/site";

const TOLEDO = {
  geoname_id: 2510409, name: "Toledo", ascii_name: "Toledo", country_code: "ES",
  lat: 39.86, lon: -4.02, population: 83226, timezone: "Europe/Madrid",
  elevation: 529, slug: "toledo-es", display_name: "Toledo",
};

beforeEach(() => { rpc.mockReset(); });

describe("resolveDynamicCity", () => {
  it("returns the city, with its IANA timezone and its real elevation", async () => {
    rpc.mockResolvedValue({ data: [TOLEDO], error: null });
    const got = await resolveDynamicCity("es", "toledo-es");
    expect(got?.city.timezone).toBe("Europe/Madrid");
    expect(got?.city.elevation).toBe(529);
    expect(got?.city.id).toBe("geonames:2510409");
    expect(got?.city.source).toBe("geonames");
  });

  it("never queries the database for a slug the prefilter rejects", async () => {
    expect(await resolveDynamicCity("es", "aaaa")).toBeNull();
    expect(await resolveDynamicCity("es", "../../etc/passwd")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null on a miss, and does not throw", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await resolveDynamicCity("es", "nowhere-zz")).toBeNull();
  });

  it("returns null when Supabase errors, rather than propagating", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await resolveDynamicCity("es", "toledo-es")).toBeNull();
  });

  it("resolves the id alias through the id RPC and reports the canonical slug", async () => {
    rpc.mockResolvedValue({ data: [TOLEDO], error: null });
    const got = await resolveDynamicCity("es", "id-2510409");
    expect(rpc).toHaveBeenCalledWith("city_by_geoname_id",
      { p_geoname_id: 2510409, p_locale: "es" });
    expect(got?.canonicalSlug).toBe("toledo-es");
  });

  /**
   * Q-B(a): where city_names has no entry the GeoNames endonym is served and the
   * page says so. Measured 2026-08-26: coverage is 17.8% in ru and 2.3% in lt.
   */
  it("falls back to the GeoNames name and flags it when there is no localized name", async () => {
    rpc.mockResolvedValue({ data: [{ ...TOLEDO, display_name: "Toledo" }], error: null });
    const got = await resolveDynamicCity("lt", "toledo-es");
    expect(got?.city.name).toBe("Toledo");
    expect(got?.nameIsLocalized).toBe(false);
  });
});

describe("URL builders", () => {
  it("uses the locale prefix and never localizes the slug", () => {
    expect(dynamicCityPathname("es", "toledo-es")).toBe("/vitamina-d/toledo-es");
    expect(dynamicCityPathname("en", "toledo-es")).toBe("/vitamin-d/toledo-es");
    expect(dynamicCityPathname("lt", "toledo-es")).toBe("/vitaminas-d/toledo-es");
  });

  it("builds absolute URLs with es prefix-free", () => {
    expect(dynamicCityUrl("es", "toledo-es")).toBe(`${SITE_URL}/vitamina-d/toledo-es`);
    expect(dynamicCityUrl("fr", "toledo-es")).toBe(`${SITE_URL}/fr/vitamine-d/toledo-es`);
  });

  it("gives six hreflang alternates plus x-default at es, like buildCityAlternates", () => {
    const alt = buildDynamicCityAlternates("en", "toledo-es");
    expect(alt.canonical).toBe(`${SITE_URL}/en/vitamin-d/toledo-es`);
    expect(Object.keys(alt.languages)).toHaveLength(7);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d/toledo-es`);
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/city-dynamic.test.ts --maxWorkers=2
```

**Hecho cuando:** falla con `Failed to resolve import "@/lib/city-dynamic"`.

**Commit:** `test(city-dynamic): pin resolution, the prefilter, the alias and the URL shape`

---

### Paso 18: Implementar `lib/city-dynamic.ts`

- [ ] **Paso 18 · commit**

```ts
import { cache } from "react";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CITY_PREFIX } from "./city-prefix";
import { ccToFlag } from "./cc-flag";
import { isDynamicCitySlug, geonameIdFromAlias } from "./city-dynamic-slug";
import { SITE_URL } from "./site";
import { getSupabase } from "./supabase";
import { tzOffset } from "./cities-api";
import type { City } from "./types";

/**
 * ON-DEMAND CITY PAGES: resolving `/{CITY_PREFIX[locale]}/{slug}` for a city
 * that is NOT one of the 73 curated ones.
 *
 * WHY SUPABASE AND NOT public/cities15000.json (D-13). Not the weight — the data
 * quality. That file's `t` field is exactly round(lon/15) in all 33,390 records
 * without one exception: mean SOLAR time, not a civil zone. Madrid t=0 (really
 * +1), Istanbul t=2 (really +3), Reykjavik t=-1 (really 0); Kolkata (+5:30) and
 * Kathmandu (+5:45) both come out as 6. Publishing sunrise and sunset from that
 * would print a wrong hour in Madrid all 365 days, in HTML cached forever. The
 * `cities` table carries the IANA `timezone`, which `getSunTimes` and
 * `monthlySunTimes` already prefer over a fixed offset, DST included. It also
 * carries `elevation`, which the JSON does not have at all and without which
 * Bogota would print a sea-level headline.
 *
 * ONE QUERY PER PAGE, NOT PER VISIT: `cache()` shares the round trip between
 * `generateMetadata` and the page body within one render, and the rendered page
 * then enters the full route cache with no expiry (`revalidate = false`).
 */

export interface DynamicCity {
  city: City;
  /** The canonical slug, which may differ from the one asked for (id alias). */
  canonicalSlug: string;
  /** False when `city_names` had no entry for this locale — see Q-B(a). */
  nameIsLocalized: boolean;
}

interface Row {
  geoname_id: number; name: string; ascii_name: string; country_code: string;
  lat: number; lon: number; population: number; timezone: string;
  elevation: number | null; slug: string; display_name: string;
}

async function query(slug: string, locale: string): Promise<Row | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const aliasId = geonameIdFromAlias(slug);
  const { data, error } = aliasId !== null
    ? await supabase.rpc("city_by_geoname_id", { p_geoname_id: aliasId, p_locale: locale })
    : await supabase.rpc("city_by_slug", { p_slug: slug, p_locale: locale });

  // A miss and a failure both resolve to "no page". Throwing here would turn a
  // transient database blip into a 500 on a page that is cached forever.
  if (error || !data || data.length === 0) return null;
  return data[0] as Row;
}

export const resolveDynamicCity = cache(
  async (locale: string, slug: string): Promise<DynamicCity | null> => {
    // The syntactic prefilter runs FIRST, so most garbage costs no round trip.
    if (!isDynamicCitySlug(slug) && geonameIdFromAlias(slug) === null) return null;

    const row = await query(slug, locale);
    if (!row || !row.slug) return null;

    const city: City = {
      id: `geonames:${row.geoname_id}`,
      name: row.display_name || row.name,
      lat: row.lat,
      lon: row.lon,
      tz: tzOffset(row.timezone),
      timezone: row.timezone,
      elevation: row.elevation ?? undefined,
      country: row.country_code,
      flag: ccToFlag(row.country_code),
      population: row.population,
      slug: row.slug,
      source: "geonames",
    };

    return {
      city,
      canonicalSlug: row.slug,
      nameIsLocalized: row.display_name !== row.name,
    };
  },
);

/** Locale-local path (no locale prefix): "/vitamin-d/toledo-es". */
export function dynamicCityPathname(locale: string, slug: string): string {
  return `/${CITY_PREFIX[locale] ?? CITY_PREFIX.es}/${slug}`;
}

/** Absolute URL including the locale prefix (es is prefix-free). */
export function dynamicCityUrl(locale: string, slug: string): string {
  return `${SITE_URL}${getPathname({
    href: dynamicCityPathname(locale, slug),
    locale: locale as (typeof routing.locales)[number],
  })}`;
}

/**
 * Self-referencing canonical + the six hreflang alternates, mirroring
 * `buildCityAlternates`. NEVER canonical to the nearest curated city: canonical
 * means "this is the same page", and Toledo is not Madrid (D-15). On a `noindex`
 * page hreflang is simply ignored, so it costs nothing — and the day a city is
 * promoted to curated, the reciprocity is already there.
 */
export function buildDynamicCityAlternates(
  locale: string,
  slug: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = dynamicCityUrl(l, slug);
  languages["x-default"] = dynamicCityUrl(routing.defaultLocale, slug);
  return { canonical: dynamicCityUrl(locale, slug), languages };
}
```

Requiere exportar `tzOffset` desde `lib/cities-api.ts` (hoy es privada) y crear
`lib/cc-flag.ts` — ambas cosas se hacen en el Paso 21; **hasta entonces el typecheck no
pasa**, y eso es correcto en un flujo TDD. Si prefieres el árbol siempre verde, adelanta el
Paso 21 antes de este.

**Hecho cuando:** el fichero existe.

**Commit:** `feat(city-dynamic): resolve an on-demand city from Supabase`

---

### Paso 19: Unificar `ccToFlag` y exportar `tzOffset`

- [ ] **Paso 19 · commit**

1. Crea `lib/cc-flag.ts` con la única `ccToFlag`, copiada literalmente de
   `lib/cities-api.ts:17-22` (la versión con la guarda `!cc || cc.length !== 2`, que es la
   más defensiva de las dos).
2. `lib/cities-api.ts` y `lib/geonames.ts` la importan de ahí y borran su copia.
3. `lib/cities-api.ts` exporta `tzOffset`.

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
rg -n "function ccToFlag" lib/     # debe devolver una sola línea, en lib/cc-flag.ts
npm run typecheck && npm run lint
```

**Hecho cuando:** una sola definición y ambos comandos limpios.

**Commit:** `refactor(cities): one ccToFlag, and export tzOffset for the dynamic resolver`

---

### Paso 20: Test que pasa — `resolveDynamicCity`

- [ ] **Paso 20 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/city-dynamic.test.ts --maxWorkers=2
```

**Hecho cuando:** verde, incluido el assert de que el prefiltro no consulta la base.

**Commit:** `test(city-dynamic): resolver green`

---

### Paso 21: Test que falla — `slug` y `elevation` llegan al cliente

- [ ] **Paso 21 · commit**

Crea `lib/__tests__/cities-api-mapping.test.ts` sobre `toCity` (hay que exportarla):

```ts
import { describe, it, expect } from "vitest";
import { toCity } from "@/lib/cities-api";

const ROW = {
  geoname_id: 3688689, name: "Bogotá", ascii_name: "Bogota", country_code: "CO",
  lat: 4.61, lon: -74.08, population: 7674366, timezone: "America/Bogota",
  elevation: 2640, slug: "bogota-co", display_name: "Bogotá",
};

describe("toCity", () => {
  /**
   * Elevation is not decoration here: with UVI_ALTITUDE_GAIN_PER_KM = 0.08,
   * serving Bogota at sea level changes the month count the app prints. Before
   * this, EVERY searched city was sea level.
   */
  it("carries the real elevation through, instead of leaving it undefined", () => {
    expect(toCity(ROW).elevation).toBe(2640);
  });

  it("carries the canonical slug", () => {
    expect(toCity(ROW).slug).toBe("bogota-co");
  });

  it("keeps working for a row that predates the two columns", () => {
    const { elevation, slug, ...old } = ROW;
    const city = toCity(old as never);
    expect(city.elevation).toBeUndefined();
    expect(city.slug).toBeUndefined();
    expect(city.timezone).toBe("America/Bogota");
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/cities-api-mapping.test.ts --maxWorkers=2
```

**Hecho cuando:** falla (`toCity` no exportada, o `elevation`/`slug` sin mapear).

**Commit:** `test(cities-api): pin slug and elevation reaching the client City`

---

### Paso 22: Implementar el mapeo

- [ ] **Paso 22 · commit**

1. `lib/types.ts`: añade a `City`

```ts
  /**
   * The canonical URL slug of this city's on-demand page (`toledo-es`). Present
   * only for rows that come from the `cities` table, which is where the slug is
   * assigned once and never recomputed. Curated cities do not use it — their
   * slug is localized and lives in lib/city-slugs.ts.
   */
  slug?: string;
```

2. `lib/cities-api.ts`: `SupabaseCity` gana `elevation?: number | null` y `slug?: string`;
   `toCity` los mapea (`elevation: row.elevation ?? undefined`); exporta `toCity`.
3. `app/api/cities/route.ts`: no cambia el código —las RPC ya devuelven las dos columnas
   nuevas y `select("*")` las incluye—, pero **sí** añade un comentario de una línea sobre
   la respuesta diciendo que `slug` y `elevation` forman parte del contrato desde esta
   migración.

**Hecho cuando:** `npm run typecheck` y `npm run lint` limpios.

**Commit:** `feat(cities-api): carry slug and elevation into the client City`

---

### Paso 23: Test que pasa

- [ ] **Paso 23 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/cities-api-mapping.test.ts --maxWorkers=2
```

**Commit:** `test(cities-api): mapping green`

---

### Paso 24: El fallback local emite el alias

- [ ] **Paso 24 · commit**

`lib/geonames.ts` sirve el buscador cuando `/api/cities` no está disponible, y solo
conoce el `geonameid`: no puede saber el slug. Que emita la forma alias.

En el `map` de `ensureLoaded`, añade `slug: \`id-${r.i}\`` con este comentario:

```ts
// The local fallback has ids, not slugs — the slug map lives in the database.
// It emits the alias form, which the city route answers with a 301 to the
// canonical URL (lib/city-dynamic-slug.ts). One extra hop beats a dead link.
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npm run typecheck && npm run lint
```

**Commit:** `feat(geonames): the local fallback emits the id alias as its slug`

---

# FASE 3 — Cercanas por coordenadas (Pasos 25-27)

### Paso 25: Test que falla — `nearbyCitiesTo`

- [ ] **Paso 25 · commit**

Añade a `lib/__tests__/city-nearby.test.ts`:

```ts
import { nearbyCities, nearbyCitiesTo } from "@/lib/city-nearby";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug } from "@/lib/city-routes";

describe("nearbyCitiesTo — cross-links for a page that is not itself a builtin", () => {
  it("returns builtin cities only, so every outbound link points at an indexable page", () => {
    const got = nearbyCitiesTo(39.86, -4.02, 5);   // Toledo
    expect(got).toHaveLength(5);
    for (const c of got) expect(c.id.startsWith("builtin:")).toBe(true);
  });

  it("orders them by distance, nearest first", () => {
    const got = nearbyCitiesTo(39.86, -4.02, 5);
    expect(baseSlug(got[0].id)).toBe("madrid");
  });

  it("includes the city itself when the coordinate IS a builtin — the caller excludes it", () => {
    const madrid = BUILTIN_CITIES.find((c) => baseSlug(c.id) === "madrid")!;
    expect(baseSlug(nearbyCitiesTo(madrid.lat, madrid.lon, 1)[0].id)).toBe("madrid");
  });

  /**
   * The refactor guard (spec R-1). `nearbyCities` decides the cross-link block of
   * 438 city pages + 2880 month pages + 240 hubs, and the ORDER of those links is
   * published content. If it moves, content ships to 3,558 pages the sitemap
   * declares unchanged.
   */
  it("leaves nearbyCities byte-identical for every builtin city", () => {
    for (const city of BUILTIN_CITIES) {
      const viaId = nearbyCities(city.id).map((c) => c.id);
      const viaCoords = nearbyCitiesTo(city.lat, city.lon, 6)
        .filter((c) => c.id !== city.id).slice(0, 5).map((c) => c.id);
      expect(viaCoords, city.id).toEqual(viaId);
    }
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/city-nearby.test.ts --maxWorkers=2
```

**Hecho cuando:** falla porque `nearbyCitiesTo` no existe.

**Commit:** `test(city-nearby): pin the coordinate-based cross-links`

---

### Paso 26: Implementar `nearbyCitiesTo`

- [ ] **Paso 26 · commit**

```ts
/**
 * The `n` builtin cities nearest to a COORDINATE, nearest first — including one
 * that sits on the coordinate itself. Always over BUILTIN_CITIES, never over the
 * dynamic set: every outbound link from an on-demand page must land on an
 * indexable page. A dynamic-to-dynamic mesh would spread link flow across
 * 1.4 M `noindex` URLs, which is the residual SEO risk D-15 closes.
 */
export function nearbyCitiesTo(lat: number, lon: number, n = 5): City[] {
  return BUILTIN_CITIES
    .map((c) => ({ city: c, km: haversineKm(lat, lon, c.lat, c.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((x) => x.city);
}
```

Y `nearbyCities` pasa a ser el envoltorio fino, **conservando exactamente su semántica
actual** (excluye la propia ciudad, `n = 5` por defecto, empates resueltos por el orden del
array):

```ts
export function nearbyCities(cityId: string, n = 5): City[] {
  const base = BUILTIN_CITIES.find((c) => c.id === cityId);
  if (!base) return [];
  return nearbyCitiesTo(base.lat, base.lon, n + 1).filter((c) => c.id !== base.id).slice(0, n);
}
```

**Hecho cuando:** `npm run typecheck` limpio.

**Commit:** `feat(city-nearby): cross-links from a bare coordinate`

---

### Paso 27: Test que pasa — y el baseline sigue intacto

- [ ] **Paso 27 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx vitest run lib/__tests__/city-nearby.test.ts lib/__tests__/city-nearby-baseline.test.ts --maxWorkers=2
```

**Hecho cuando:** ambos verdes **sin haber tocado**
`lib/__tests__/fixtures/nearby-cities-baseline.json`. Si el fixture hubiera que tocarlo, el
refactor cambió contenido publicado en 3.558 páginas: revierte y arréglalo.

**Commit:** `test(city-nearby): coordinate cross-links green, baseline untouched`

---

# FASE 4 — Copy (Pasos 28-30)

### Paso 28: Test que falla — las claves nuevas en los 6 idiomas

- [ ] **Paso 28 · commit**

Crea `messages/__tests__/city-dynamic-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

const LOCALES = { es, en, fr, de, ru, lt } as Record<string, { cityPage: Record<string, string> }>;
const NEW_KEYS = ["dynamicProvenance", "dynamicNameLatin"] as const;

describe("on-demand city page copy", () => {
  /**
   * next-intl does NOT throw on a missing message: it renders the literal
   * "cityPage.dynamicProvenance" into HTML with a 200 status. A missing key is
   * silently degraded copy, not a crash, which is why this is pinned.
   */
  it("exists in all six locales", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of NEW_KEYS) {
        expect(messages.cityPage[key], `${locale}.cityPage.${key}`).toBeTruthy();
      }
    }
  });

  it("interpolates the city name in the provenance line", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(messages.cityPage.dynamicProvenance, locale).toContain("{city}");
    }
  });

  /**
   * CLAUDE.md's hard rule: any factual claim in messages/*.json that names a
   * threshold, an angle, a duration or a criterion is a claim about lib/ and has
   * to be verified against the module that computes it. Five stale claims reached
   * production that way. These two keys satisfy it BY CONSTRUCTION: no numbers.
   */
  it("states no figure, so there is nothing to go stale", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of NEW_KEYS) {
        expect(messages.cityPage[key], `${locale}.${key}`).not.toMatch(/\d/);
      }
    }
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run messages/__tests__/city-dynamic-copy.test.ts --maxWorkers=2
```

**Hecho cuando:** falla en las seis locales.

**Commit:** `test(messages): pin the on-demand city page provenance copy`

---

### Paso 29: Escribir las claves

- [ ] **Paso 29 · commit**

En los seis ficheros, **dentro del namespace `cityPage`** (Aviso 2), junto a
`howCalculated`:

| Clave | es | en |
|---|---|---|
| `dynamicProvenance` | `Datos de {city} de GeoNames. No es una de nuestras ciudades destacadas: esta página se genera bajo demanda con sus coordenadas, su zona horaria y su altitud.` | `{city} data from GeoNames. It is not one of our featured cities: this page is generated on demand from its coordinates, its time zone and its elevation.` |
| `dynamicNameLatin` | `El nombre se muestra en su grafía original porque no tenemos una traducción para este idioma.` | `The name is shown in its original spelling because we have no translation for this language.` |

fr, de, ru y lt: **pendientes de traducción nativa**. Pueden llevar el texto en inglés como
marcador **si y solo si el cuerpo de la PR lo declara**. Lo que no puede pasar es que falte
la clave: next-intl renderiza `cityPage.dynamicProvenance` dentro de un HTML con 200.

`i18n/client-messages.ts` **no se toca**: `cityPage` ya está en `CLIENT_NAMESPACES`
(línea 84).

**Hecho cuando:** las dos claves están en los seis ficheros.

**Commit:** `feat(messages): provenance copy for the on-demand city pages`

---

### Paso 30: Test que pasa

- [ ] **Paso 30 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx vitest run messages/__tests__ i18n/__tests__ --maxWorkers=2
```

**Hecho cuando:** verde, incluidos `key-parity` y `client-messages` (que caminan el grafo
real de módulos cliente).

**Commit:** `test(messages): provenance copy green`

---

# FASE 5 — La ruta (Pasos 31-35)

### Paso 31: Test que falla — la ruta de ciudad

- [ ] **Paso 31 · commit**

Crea `app/__tests__/city-route-dynamic.test.ts`. Es un test **de código fuente** en su
mayor parte, del mismo estilo que `app/__tests__/sun-hub-split.test.ts` y
`app/__tests__/prose-gating.test.ts` (que ya afirman cosas sobre este árbol leyendo el
fichero), porque montar un server component async con `next-intl/server` en jsdom no es
barato y lo que hay que clavar aquí son propiedades del fichero:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = join(process.cwd(), "app", "[locale]", "[cityPrefix]", "[city]", "page.tsx");
const source = readFileSync(ROUTE, "utf8");

describe("the city route after the on-demand branch lands", () => {
  /**
   * D-16. Segment config is per FILE, and both families want the same class: the
   * content is a pure function of (lat, lon, elevation, tz, DOY_REFERENCE_YEAR)
   * and nothing on the render path reads a clock. Sharing the file therefore does
   * NOT reintroduce the problem of commit f5d45c7, where 438 pages paid the 240
   * hubs' revalidate — and the 438 keep the saving from 2026-08-22 intact.
   */
  it("keeps revalidate = false", () => {
    expect(source).toMatch(/export const revalidate = false/);
  });

  /** dynamicParams is not exported anywhere in the repo, so it is already true. */
  it("does not export dynamicParams", () => {
    expect(source).not.toMatch(/export const dynamicParams/);
  });

  /**
   * D-15, the central lock: 1.38 M thin URLs must not ask for a place in the
   * index. `follow` so internal outbound links keep passing.
   */
  it("marks the dynamic branch noindex, follow — and never the curated one", () => {
    expect(source).toMatch(/index:\s*false/);
    expect(source).toMatch(/follow:\s*true/);
    const curatedBlock = source.slice(0, source.indexOf("index: false"));
    expect(curatedBlock).toContain("buildCityAlternates");
  });

  /** The header used to claim ONE FAMILY LIVES HERE NOW. Two families do now. */
  it("no longer claims a single family lives here", () => {
    expect(source).not.toContain("ONE FAMILY LIVES HERE NOW");
  });

  /** No new namespace in this file, or content-revision's mirror test goes red. */
  it("reads only the cityPage and sunTimes namespaces", () => {
    const found = [...source.matchAll(/namespace:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(found)].sort()).toEqual(["cityPage", "sunTimes"]);
  });

  /** Every outbound link goes to a curated page or to the index. Never to another dynamic one. */
  it("cross-links through the builtin-only helper", () => {
    expect(source).toContain("nearbyCitiesTo");
    expect(source).toContain("indexPathname");
  });
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run app/__tests__/city-route-dynamic.test.ts --maxWorkers=2
```

**Hecho cuando:** fallan al menos los asserts de `noindex`, de la cabecera y de
`nearbyCitiesTo`.

**Commit:** `test(city-route): pin the on-demand branch's caching and indexing policy`

---

### Paso 32: Implementar la rama dinámica en la ruta

- [ ] **Paso 32 · commit**

Modifica `app/[locale]/[cityPrefix]/[city]/page.tsx`:

**a) Reescribe la cabecera del fichero.** Hoy afirma "ONE FAMILY LIVES HERE NOW" y que
todo lo que vive aquí está prerenderizado. Las dos cosas dejan de ser ciertas. La nueva
dice, en sustancia: aquí viven dos familias — las 438 curadas, prerenderizadas por
`generateStaticParams`, y la capa bajo demanda, que entra por `dynamicParams` (que **ya**
valía `true` por defecto: no había que activar nada, lo único que cambia es lo que hace
`resolveCity`). Ambas comparten `revalidate = false` porque ambas son función pura de
(lat, lon, elevación, tz, `DOY_REFERENCE_YEAR`). El chequeo de prefijo sigue siendo
load-bearing: `/en/vitamina-d/madrid` tiene que dar 404. Y los params de los hubs no
pueden reaparecer en `generateStaticParams`.

**b) `resolveCity` pasa a async y devuelve un resultado discriminado:**

```ts
type Resolved =
  | { kind: "builtin"; city: City; base: string }
  | { kind: "dynamic"; city: City; slug: string; nameIsLocalized: boolean }
  | { kind: "redirect"; to: string };

async function resolveCity({ locale, cityPrefix, city }: Params): Promise<Resolved | null> {
  if (cityPrefix !== CITY_PREFIX[locale]) return null;

  // The curated namespace is consulted FIRST and always wins (D-12).
  const cityId = cityIdFromSlug(locale, city);
  if (cityId) {
    const found = BUILTIN_CITIES.find((c) => c.id === cityId);
    return found ? { kind: "builtin", city: found, base: baseSlug(found.id) } : null;
  }

  const hit = await resolveDynamicCity(locale, city);
  if (!hit) return null;

  // ONE CITY, ONE URL. The qualified form of a curated city (`shanghai-cn`) and
  // its id alias both 301 to the curated URL; a dynamic city asked for by alias
  // 301s to its canonical slug.
  const curatedBase = Object.entries(BUILTIN_GEONAME_ID)
    .find(([, id]) => `geonames:${id}` === hit.city.id)?.[0];
  if (curatedBase) return { kind: "redirect", to: cityPathname(locale, curatedBase) };
  if (hit.canonicalSlug !== city) {
    return { kind: "redirect", to: dynamicCityPathname(locale, hit.canonicalSlug) };
  }

  return {
    kind: "dynamic", city: hit.city, slug: hit.canonicalSlug,
    nameIsLocalized: hit.nameIsLocalized,
  };
}
```

`redirect()` de `next/navigation` se llama en el cuerpo del componente con
`permanentRedirect` (301). En `generateMetadata`, una redirección devuelve `{}`.

**c) `generateMetadata`:** en la rama `builtin` no cambia nada. En la `dynamic`:

```ts
  const alternates = buildDynamicCityAlternates(p.locale, r.slug);
  return {
    title, description, alternates,
    // D-15: the family enters without asking for a place in the index. `follow`
    // so the outbound links to the index and to curated cities keep passing.
    robots: { index: false, follow: true },
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
```

Los `labels` de la rama dinámica se construyen con `cityLabels(p.locale, r.city.name)` —
el `display_name` de la RPC, no el slug.

**d) El cuerpo del componente:** todo el render existente se conserva. Lo que cambia:

- `elevationM` pasa a ser, en la rama dinámica,
  `r.city.elevation ?? inferElevationM(r.city.lat, r.city.lon) ?? 0`
  (importa `inferElevationM` de `@/lib/elevation`; su umbral de 25 km no se toca, D-2).
- `const nearby = r.kind === "builtin" ? nearbyCities(r.city.id) : nearbyCitiesTo(r.city.lat, r.city.lon, 5)`.
  Las tarjetas siguen enlazando a curadas con `cityPathname` — nunca a otra dinámica.
- Debajo del `<nav>` de cercanas, solo en la rama dinámica:

```tsx
<p className="mt-4 text-caption text-text-muted">
  {t("dynamicProvenance", { city: r.city.name })}
  {!r.nameIsLocalized && ` ${t("dynamicNameLatin")}`}
</p>
```

- `NotificationToggle` y `SunTimesPanel` reciben `r.city.timezone` igual que ahora.

**e) `generateStaticParams` no cambia:** sigue devolviendo las 438 de `cityStaticParams()`.
Las dinámicas no se prerenderizan nunca.

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npm run typecheck && npm run lint
```

**Hecho cuando:** ambos limpios.

**Commit:** `feat(city-route): serve an on-demand page for any searchable city`

---

### Paso 33: Test que pasa — la ruta

- [ ] **Paso 33 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx vitest run app/__tests__/city-route-dynamic.test.ts app/__tests__/sun-hub-split.test.ts app/__tests__/prose-gating.test.ts --maxWorkers=2
```

**Hecho cuando:** los tres verdes. `sun-hub-split` es load-bearing: reensambla los 240 hubs
desde disco, y si esta ruta se hubiera comido params suyos, se enteraría aquí.

**Commit:** `test(city-route): on-demand branch green`

---

### Paso 34: Test que falla — el chip enlaza a la ciudad buscada

- [ ] **Paso 34 · commit**

Añade a `lib/__tests__/city-client-links.test.ts` y a
`components/__tests__/CityPageLink.test.tsx`:

```ts
// lib/__tests__/city-client-links.test.ts
describe("directoryTarget — a searchable city now has its own page", () => {
  it("sends a geonames city to its own on-demand page, not to a stand-in", () => {
    // Toledo: 67 km from Madrid, |dlat| 1.05deg — under the old rule this was a
    // silent redirect to "the full Madrid page".
    const t = directoryTarget("geonames:2510409", 39.86, -4.02);
    expect(t.kind).toBe("dynamic");
    expect(t).toMatchObject({ geonameId: 2510409 });
  });

  it("still prefers the curated page when the saved city IS a builtin", () => {
    expect(directoryTarget("builtin:madrid", 40.42, -3.7)).toEqual({ kind: "exact", base: "madrid" });
  });

  /**
   * A raw coordinate has no city row behind it (GPS fix, map tap): the nearby
   * rule of PR A still applies, distance printed and all. B does not remove it.
   */
  it("keeps the km-printing nearby branch for a bare coordinate", () => {
    const t = directoryTarget(undefined, 39.86, -4.02);
    expect(t.kind).toBe("nearby");
  });

  it("never returns null", () => {
    for (const [lat, lon] of [[-54.8, -68.3], [64.18, -51.72], [0, -160]]) {
      expect(directoryTarget(undefined, lat, lon)).not.toBeNull();
    }
  });
});
```

```tsx
// components/__tests__/CityPageLink.test.tsx
it("names the SEARCHED city, not the stand-in, and links to its own page", () => {
  render(<CityPageLink cityId="geonames:2510409" cityName="Toledo" lat={39.86} lon={-4.02} />);
  const link = screen.getByRole("link");
  expect(link).toHaveAttribute("href", expect.stringContaining("/id-2510409"));
  expect(link.textContent).toContain("Toledo");
  expect(link.textContent).not.toContain("Madrid");
});
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx vitest run lib/__tests__/city-client-links.test.ts components/__tests__/CityPageLink.test.tsx --maxWorkers=2
```

**Hecho cuando:** falla.

**Commit:** `test(chip): pin that a searchable city links to its own page, named correctly`

---

### Paso 35: Implementar el chip

- [ ] **Paso 35 · commit**

1. `lib/city-client-links.ts`: `DirectoryTarget` gana la variante

```ts
  /**
   * A searchable city that is not curated. It now has a page of its own, so the
   * chip stops substituting: no stand-in, no distance to explain. The link uses
   * the `id-{geonameid}` alias because that id is the only thing the saved
   * preference carries — the route 301s it to the canonical slug.
   */
  | { kind: "dynamic"; geonameId: number }
```

y `directoryTarget` antepone, justo después de la rama `builtin:`:

```ts
  const geo = /^geonames:(\d+)$/.exec(cityId ?? "");
  if (geo) return { kind: "dynamic", geonameId: Number(geo[1]) };
```

Las ramas `nearby` (con y sin km) y `index` **se quedan exactamente como están**: siguen
sirviendo al caso de coordenada cruda (GPS, toque en el mapa, `custom:${Date.now()}`), que
es donde no hay fila de ciudad detrás.

2. `components/CityPageLink.tsx`: prop nueva `cityName?: string`; en la rama `dynamic`
   `href = \`${indexPath(locale)}/id-${target.geonameId}\`` y
   `label = tCity("viewCityPage", { city: cityName ?? "" })` — el nombre de la ciudad
   **buscada**, que es el bug de origen. Si `cityName` no llega, cae a la rama `nearby` de
   siempre, para no imprimir nunca un nombre vacío.

3. `app/[locale]/dashboard/page.tsx:112` y `app/[locale]/explore/page.tsx:142`: pasan
   `cityName={app.cityName}` y `cityName={cityName}` respectivamente (el nombre ya está en
   el contexto y en `useCityDisplayName`; no hace falta estado nuevo ni tocar la
   persistencia).

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx vitest run lib/__tests__/city-client-links.test.ts components/__tests__/CityPageLink.test.tsx --maxWorkers=2
npm run typecheck && npm run lint
```

**Hecho cuando:** los dos ficheros de test verdes y ambos comandos limpios.

**Commit:** `feat(chip): link a searchable city to its own page and name the city searched`

---

# FASE 6 — Los cerrojos SEO (Pasos 36-38)

### Paso 36: El cerrojo del sitemap

- [ ] **Paso 36 · commit**

Añade a `app/__tests__/sitemap.test.ts`, dentro del `describe("sitemap")` existente:

```ts
  /**
   * THE LOCK THAT FAILS SILENTLY IF IT IS NOT PINNED (R-5).
   *
   * The dynamic city family is 230,407 rows x 6 locales = 1,382,442 URLs. The
   * sitemap is a crawl REQUEST, and this project's binding meter is
   * (URLs crawled) x (bytes served), currently at 95% of 1,000,000. Listing them
   * would be pure cost against a `noindex` family that cannot rank by design.
   *
   * Worse, scripts/indexnow.ts builds its submission list by importing this very
   * function, so a URL that leaks in here ends up PUSHED to Bing — which the
   * module itself describes as the abusable move.
   */
  it("never lists a qualified (on-demand) city URL", () => {
    const qualified = entries.filter((e) => /\/[a-z0-9-]+-[a-z]{2}(-\d+)?$/.test(new URL(e.url).pathname));
    expect(qualified.map((e) => e.url)).toEqual([]);
  });

  it("never lists an id-alias URL", () => {
    expect(entries.filter((e) => /\/id-\d+$/.test(e.url)).map((e) => e.url)).toEqual([]);
  });
```

**Prueba de falsabilidad, obligatoria y en el mismo paso:** un assert que pasa desde el
primer momento no es un test hasta que se demuestra que puede fallar. Añade temporalmente
en `app/sitemap.ts`, al final del `return`, `{ url: \`${SITE_URL}/vitamina-d/toledo-es\`,
lastModified: "2026-08-26", changeFrequency: "monthly" as const, priority: 0.7,
alternates: { languages: { en: "x" } } }`, corre el test, **comprueba que se pone rojo**,
y quita la línea. Deja constancia en el mensaje del commit.

Y añade a la cabecera de política de `app/sitemap.ts` un párrafo:

```
 * WHY THE ON-DEMAND CITY PAGES ARE DELIBERATELY ABSENT. `/{cityPrefix}/{slug}`
 * also serves any city in the `cities` table (230,407 rows on 2026-08-26), which
 * is 1,382,442 URLs across six locales. They are `noindex, follow` by design
 * (D-15) — the `vitamina-d` template earns 35 impressions and 0 clicks in 28 days
 * with 438 URLs, so multiplying it by three thousand is thin content on a domain
 * with 19 inbound links. Listing them here would be a crawl request billed to the
 * read meter for pages that cannot rank. `app/__tests__/sitemap.test.ts` pins
 * their absence, and lib/__tests__/indexnow.test.ts pins that they never reach a
 * submission — because this function is what that script imports.
```

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run app/__tests__/sitemap.test.ts --maxWorkers=2
```

**Hecho cuando:** los 3.612 siguen (`54 + 438 + SUNRISE_CITIES.length * 13 * 6`), los dos
asserts nuevos verdes, y la prueba de falsabilidad hecha.

**Commit:** `test(sitemap): lock the on-demand city family out of the sitemap`

---

### Paso 37: El cerrojo de IndexNow

- [ ] **Paso 37 · commit**

Añade a `lib/__tests__/indexnow.test.ts`:

```ts
import sitemap from "@/app/sitemap";

describe("the on-demand city family never reaches a submission", () => {
  /**
   * scripts/indexnow.ts builds its list by importing app/sitemap.ts, so today
   * nothing leaks by itself. This turns that accident into a guarantee: a future
   * change to the sitemap cannot quietly push 1.4 M `noindex` URLs to Bing,
   * which is the abuse this module's own header warns about.
   */
  it("builds no payload containing a qualified or id-alias city URL", () => {
    const urls = sitemap().map((e) => e.url);
    for (const payload of buildPayloads(urls)) {
      for (const url of payload.urlList) {
        expect(url, url).not.toMatch(/\/[a-z0-9-]+-[a-z]{2}(-\d+)?$/);
        expect(url, url).not.toMatch(/\/id-\d+$/);
      }
    }
  });
});
```

Misma prueba de falsabilidad que en el paso anterior: mete una URL cualificada a mano en el
array `urls` del test, comprueba que se pone rojo, y quítala.

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/indexnow.test.ts --maxWorkers=2
```

**Commit:** `test(indexnow): guarantee the on-demand URLs are never submitted`

---

### Paso 38: `robots.txt` — comprobar que NO hay que tocarlo

- [ ] **Paso 38 (sin commit salvo que falte el comentario)**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && cat app/robots.ts 2>/dev/null || cat public/robots.txt
```

**No se cambia.** Prohibir el prefijo bloquearía también las 438 curadas, que comparten
`/vitamina-d/`. El instrumento correcto es la etiqueta `robots` por página, que ya está en
el Paso 32. Si el fichero no lo dice, añade una línea de comentario explicándolo y
commitea; si no hay dónde ponerla, salta el paso.

**Hecho cuando:** confirmado que `Allow: /` sigue y anotado el porqué.

---

# FASE 7 — El fingerprint (Paso 39)

### Paso 39: Re-basar los `parts` sin mover la fecha

- [ ] **Paso 39 · commit**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npx vitest run lib/__tests__/content-revision.test.ts --maxWorkers=2
```

Va a fallar e imprimir un bloque listo para pegar **con la fecha de hoy ya rellenada**.

**LEE EL DIFF ANTES DE PEGAR NADA.** Qué se ha tocado de lo que ese hash cubre, y qué
significa cada caso:

- `copy.*` se mueve porque el namespace `cityPage` gana dos claves. **Las 438 curadas no
  renderizan ninguna de las dos.** Cambio de instrumento → la fecha NO se mueve.
- `figures` se mueve **solo si** has editado alguno de `lib/solar.ts`, `lib/sun-times.ts`,
  `lib/city-content.ts`, `lib/city-copy.ts`, `lib/uv-model.ts`, `lib/vitd.ts`. Este plan no
  toca ninguno. **Si `figures` se ha movido, para y averigua por qué**: significa que has
  cambiado lo que imprimen las 438, y entonces la fecha SÍ tiene que moverse.
- `cities` se mueve solo si cambia `BUILTIN_CITIES` o los nombres localizados. Este plan no
  los toca.

Pega los `parts` nuevos en `lib/content-revision.ts` y **deja `CITY_PAGE_REVISION.date`
exactamente como estaba**. Comprueba:

```bash
git diff lib/content-revision.ts     # una pantalla: cambian parts, NO date
npx vitest run lib/__tests__/content-revision.test.ts --maxWorkers=2
```

**Hecho cuando:** el test verde y `git diff` enseña que `date` no se ha movido.

**Commit:** `chore(content-revision): re-base the city page fingerprint (instrument, not content)`

---

# FASE 8 — Verificación (Pasos 40-45)

### Paso 40: Estático — lint y typecheck

- [ ] **Paso 40 (sin commit)**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npm run typecheck && npm run lint
```

**Hecho cuando:** ambos sin salida de error.

---

### Paso 41: Suite completa, una sola vez

- [ ] **Paso 41 (sin commit)**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind && npm test -- --maxWorkers=2
```

**No lances nada más mientras corre.** Si aparece
`[vitest-pool]: Failed to start forks worker — Timeout waiting for worker to respond`, es
saturación: espera, cierra lo que puedas y relanza con `--maxWorkers=1`. El recuento local
de ficheros puede quedarse corto (se ha observado 37/51 bajo carga); el recuento válido es
el de CI.

**Hecho cuando:** cero fallos. En particular, verdes:
`lib/__tests__/city-nearby-baseline.test.ts` (Aviso 4),
`lib/__tests__/content-revision.test.ts`, `app/__tests__/sitemap.test.ts`,
`app/__tests__/sun-hub-split.test.ts`, `i18n/__tests__/client-messages.test.ts`.

---

### Paso 42: Verificación SEO sobre el HTML realmente servido

Antes de dar B por buena hay que **mirar el HTML**, no los tests. Los tests dicen lo que el
código pretende; esto dice lo que sale por el cable.

- [ ] **Paso 42 (sin commit) — segundo y último build autorizado**

```bash
cd /c/Users/Usuario/github/vitamind/vitamind
npx next build          # >2 min, en segundo plano. NUNCA `rtk next build`.
npx next start -p 3210
```

Comprueba, una por una:

```bash
# 1. Una dinámica: 200, noindex+follow, canonical a SÍ MISMA, 6 hreflang + x-default.
curl -s http://localhost:3210/vitamina-d/toledo-es > /tmp/dyn.html
rg -o '<meta name="robots" content="[^"]*"' /tmp/dyn.html          # noindex, follow
rg -o '<link rel="canonical" href="[^"]*"' /tmp/dyn.html           # .../vitamina-d/toledo-es
rg -c 'rel="alternate"' /tmp/dyn.html                              # 7
rg -o 'hreflang="x-default" href="[^"]*"' /tmp/dyn.html            # el de es

# 2. Una curada: SIN noindex, canonical y hreflang como siempre.
curl -s http://localhost:3210/vitamina-d/madrid > /tmp/cur.html
rg -c '<meta name="robots"' /tmp/cur.html                          # 0 (o sin noindex)
rg -o '<link rel="canonical" href="[^"]*"' /tmp/cur.html           # .../vitamina-d/madrid

# 3. Una ciudad, una URL: la forma cualificada de una curada, 301.
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/vitamina-d/shanghai-cn
# 4. El alias, 301 al slug canónico.
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/vitamina-d/id-2510409

# 5. Basura: 404, y sin materializar caché (repite la comprobación del Paso 4).
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/vitamina-d/zzzz-qq-9
find .next -name "*zzzz*" | head

# 6. Prefijo de locale equivocado: sigue siendo 404.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/en/vitamina-d/madrid

# 7. Sitemap y robots.
curl -s http://localhost:3210/sitemap.xml | rg -c "<loc>"          # 3612
curl -s http://localhost:3210/sitemap.xml | rg -c "toledo-es"      # 0
curl -s http://localhost:3210/robots.txt                            # Allow: / , sin cambios

# 8. Las horas son las CIVILES, no la hora solar del JSON local: Toledo en verano
#    tiene que dar horas de Europe/Madrid, no de UTC+0.
rg -o 'sunrise[^<]{0,40}' /tmp/dyn.html | head
```

**Hecho cuando las ocho pasan.** Cualquiera que falle es bloqueante:

- si la dinámica sale sin `noindex`, el cerrojo central está abierto;
- si el canonical apunta a Madrid, es la afirmación falsa que D-15 prohíbe;
- si `/vitamina-d/shanghai-cn` sirve 200, hay dos URLs para una ciudad;
- si el sitemap sale con más de 3.612 `<loc>`, se ha filtrado la familia dinámica y por
  tanto también a IndexNow;
- si aparece un fichero de caché para `zzzz`, hay que aplicar el plan B de `force-dynamic`
  del Paso 4.

Para el servidor cuando termines.

---

### Paso 43: Verificación humana en navegador, móvil real

- [ ] **Paso 43 (sin commit)**

El navegador MCP **no mapea `resize` a viewport** (se queda en 2134 px): usa
`playwright-cli`, que sí da 390 px reales.

Con `npx next start -p 3210` levantado, a 390 px de ancho:

1. Buscar **Toledo** en Explorar → el chip dice "Ver la página completa de **Toledo**" (no
   Madrid) y lleva a una página de Toledo con su propia elevación (529 m) y sus horas de
   `Europe/Madrid`.
2. Buscar **Bogotá** → la página no la trata a nivel del mar: comprobar que el titular de
   meses no es el que saldría con elevación 0.
3. Un punto **GPS sin ciudad** (o un toque en el mapa) → sigue apareciendo la rama `nearby`
   de PR A, **con los km impresos**.
4. **Ushuaia** → el chip lleva al índice, con su copy propio; nunca desaparece.
5. Consola del navegador **sin errores**, chip legible, tap target por encima de 44 px.

**Hecho cuando:** los cinco comprobados por una persona, con captura de al menos el 1 y
el 3.

---

### Paso 44: CHECKPOINT HUMANO 4 — enseñar antes de proponer merge

- [ ] **Paso 44 (sin commit)**

Enseña al usuario, en no más de una pantalla:

1. Qué se decidió y por qué (URL cualificada, resolución por Supabase, `noindex`).
2. La corrección de magnitud: **230.407 filas, no 33.390** → 1.382.442 URLs potenciales, y
   por qué eso refuerza los cerrojos en vez de cambiarlos.
3. Qué queda abierto con opciones concretas y recomendación: Q-3 (hubs y meses dinámicos) y
   Q-4 (política de graduación), ambas para decidir con B en producción.
4. Qué se asumió: Q-B(a), el endónimo latino con línea de procedencia, con la cobertura
   medida (ru 17,8 %, lt 2,3 %).
5. Qué quedó fuera y por qué: retirar built-ins (D-11), el RPC euclídeo, el
   `custom:${Date.now()}`, el bug del offset a medianoche.
6. Dónde mirar: este plan y el spec.

**No narres el proceso ni reproduzcas el índice del documento.**

---

### Paso 45: Cerrar la PR

- [ ] **Paso 45 · commit del cuerpo de la PR**

El cuerpo de la PR tiene que incluir, porque son las cosas que un revisor no puede
reconstruir:

- **Que la migración `20260826_city_slug_elevation.sql` ya está aplicada a mano** en el
  proyecto Supabase compartido, con la fecha. El deploy al mergear es automático.
- El resultado de la medición del Paso 4 (¿cachea Next el `notFound()`?), con su comando.
- El informe de slugs del Paso 3: desempates y cero colisiones con las curadas.
- La declaración de que fr, de, ru y lt llevan las dos claves nuevas **en inglés, pendientes
  de traducción nativa** (si es el caso).
- Que `CITY_PAGE_REVISION.date` **no** se ha movido y por qué.
- Los cuatro cerrojos SEO y qué test clava cada uno.

**CHECKPOINT HUMANO 5:** el merge a `master` no lo decides tú. Y antes de cualquier `git
push`, verifica la cuenta activa: este repo es **personal** → `gh auth status` tiene que dar
`JaviMaligno`; si no, `gh auth switch --user JaviMaligno`.

---

## Contrato de cierre — B está hecha cuando todo esto es cierto

1. `/vitamina-d/toledo-es` responde 200 con la elevación y la zona horaria reales de Toledo.
2. Esa página lleva `robots: noindex, follow` y canonical **a sí misma**.
3. `/vitamina-d/madrid` **no** lleva `noindex` y su canonical y su hreflang no han cambiado.
4. `/vitamina-d/shanghai-cn` y `/vitamina-d/id-2510409` responden **301**.
5. `/en/vitamina-d/madrid` sigue dando **404**.
6. `app/sitemap.ts` sigue devolviendo **3.612** URLs y ninguna cualificada.
7. Ninguna URL cualificada puede llegar nunca a un payload de IndexNow, clavado por test.
8. Todos los enlaces salientes de una página dinámica van al índice o a una curada. Cero
   malla dinámica-a-dinámica.
9. `lib/__tests__/city-nearby-baseline.test.ts` verde **sin tocar el fixture**.
10. `CITY_PAGE_REVISION.date` sin mover; `parts` re-basados.
11. `npm run typecheck` y `npm run lint` limpios; `npm test -- --maxWorkers=2` verde.
12. Verificación humana en móvil real (390 px) hecha, consola sin errores.
13. La migración está aplicada en Supabase **antes** del merge.

## Anti-scope-creep — vinculante

No entran en esta PR, aunque aparezcan por el camino y aunque sean fáciles:

- Hubs de hoy (`/amanecer/{slug}`) o páginas mes para ciudades dinámicas (Q-3).
- Retirar páginas built-in, ni las 73 ni las 33 sin páginas mes (D-11).
- Arreglar el `distance` euclídeo-en-grados de `search_cities_nearby(_localized)`.
- El id inestable `custom:${Date.now()}` de `components/WorldMap.tsx:148`.
- Tocar `NAME_MATCH_KM` (75), `ELEVATION_MATCH_KM` (25), `SAME_PLACE_KM` (25) ni el top-N
  sin umbral de `nearbyCities` (D-2).
- El bug del offset sondeado a medianoche en días de cambio de hora (378 páginas).
- Mover el contenido de la página de ciudad dentro de Mi Día (opción C, rechazada).
