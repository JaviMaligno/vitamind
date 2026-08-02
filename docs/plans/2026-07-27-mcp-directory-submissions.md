# Plan: publicar el MCP en directorios (bloque C del plan del 19/7)

**Fecha:** 2026-07-27
**Estado (2026-07-27, final del día):** registro oficial y npm publicados; PR a punkpeye
abierta y bloqueada por Glama; Glama caído. Detalle en «Marcador» abajo.
**Contexto:** el bloque C de `docs/plans/2026-07-19-mcp-evolution-account-marketing.md`
("Directorios MCP: enviar el conector al registry y directorios cuando esté estable en
producción"). El servidor lleva estable desde el 19-20/7.

## Marcador

| Destino | Estado |
|---|---|
| **Registro MCP oficial** | ✅ `io.github.JaviMaligno/vitamind` 1.0.0, verificado contra su API |
| **npm** | ✅ `vitamind-mcp@1.0.0`, handshake probado vía `npx` contra producción |
| **Repo del paquete** | ✅ https://github.com/JaviMaligno/vitamind-mcp (+ `Dockerfile`) |
| **homepage del repo principal** | ✅ corregido: apuntaba a `vitamind-tau.vercel.app` |
| **punkpeye/awesome-mcp-servers** | ⏸️ PR [#11026](https://github.com/punkpeye/awesome-mcp-servers/pull/11026) — su bot exige ficha en Glama + badge de score |
| **Glama** | ❌ host caído (504; 1 de cada 5 peticiones responde, en ~24 s) |
| **mcpservers.org** | ⏸️ pendiente; su listado gratuito es **nofollow** |

### Lo que costó descubrir (para no repetirlo)

- **El publisher NO es el paquete `mcp-publisher` de npm.** Ese nombre pertenece a otro
  proyecto que es a su vez un servidor MCP: `npx mcp-publisher login github` arranca un
  proceso stdio en vez de autenticar. El bueno es un **binario Go** de las releases de
  `modelcontextprotocol/registry` (v1.8.0), con builds para Windows.
- **`description` tiene un máximo de 100 caracteres.** Con 152 devuelve 422.
- **El namespace distingue mayúsculas:** concede `io.github.JaviMaligno/*`; con
  `javimaligno` devuelve 403 y lista el permitido literalmente.
- Correr `mcp-publisher validate` antes de pedir login ahorra las dos primeras.

### Alternativa pendiente de decidir: namespace por DNS

El publisher admite `login dns --domain getvitamind.app`, lo que permitiría republicar
como **`app.getvitamind/vitamind`** en vez de bajo el usuario de GitHub. Mejor marca y
el dominio va en el propio identificador de la ficha. Requiere par de claves y un
registro TXT. La entrada actual no impide migrar después.

## Por qué esto y no otra cosa

El baseline de Search Console del 25/7: **4 clics y 39 impresiones en 90 días**, posición
media 9,5 con CTR del 10,3 %. Cuando aparece, aparece arriba — el problema es cobertura, y
la causa es autoridad: **7 enlaces externos de 2 dominios**, y uno es la web personal del
autor. Google rastrea a cuentagotas un dominio sin autoridad (sitemap con 2496 URLs, 474
leídas).

Cada ficha de directorio es un dominio enlazante real. Ese es el objetivo medible aquí, no
"aparecer en sitios".

## Hechos verificados (2026-07-27, contra producción)

No inventar nada de esto al rellenar formularios; está comprobado con `curl` contra el
servidor vivo y con `gh repo view`.

| Dato | Valor |
|---|---|
| Endpoint público | `https://getvitamind.app/api/mcp/mcp` |
| Endpoint con cuenta | `https://getvitamind.app/api/mcp-auth/mcp` (401 → dispara OAuth) |
| Transporte | Streamable HTTP, stateless. **Sin SSE** (no hay Redis) |
| `serverInfo` | `vitamind-explorer`, versión `1.0.0` |
| Protocolo | `2025-06-18` |
| Herramientas | **10**: 6 públicas + 4 personales con OAuth |
| Repositorio | https://github.com/JaviMaligno/vitamind — **público**, MIT |
| Homepage | https://getvitamind.app |
| Página de conexión | https://getvitamind.app/connect (`/en/connect`, `/fr/connect`, …) |
| Auth | OAuth 2.1 propio: registro dinámico de clientes, PKCE S256 obligatorio |

Las 6 herramientas públicas: `search_city`, `get_sun_times`, `get_vitamin_d_window`,
`get_vitamin_d_year`, `get_current_status`, `estimate_sun_session`.
Las 4 personales: `get_my_profile`, `get_my_cities`, `get_my_history`, `log_sun_session`.

**Cabeceras obligatorias** al llamar (documentar en cada ficha que lo permita, porque es la
causa número uno de "no me responde"):
`content-type: application/json` y `accept: application/json, text/event-stream`.
Sin el `text/event-stream` el SDK responde **406** antes de ejecutar nada.

## Qué hace falta de ti (y qué no)

Yo dejo listo el contenido. **Los envíos son acciones públicas e irreversibles, así que
los haces tú** — o me das el visto bueno explícito para cada uno.

| Directorio | Qué requiere | Quién |
|---|---|---|
| Registro MCP oficial | ~~pendiente~~ — **hecho** el 27/7 (login GitHub del owner + `publish`) | ✅ |
| `punkpeye/awesome-mcp-servers` | PR al README | Yo preparo, tú apruebas |
| `wong2/awesome-mcp-servers` | PR al README | Yo preparo, tú apruebas |
| Glama | Escanea GitHub solo; se puede reclamar el servidor | Tú (login GitHub) |
| mcp.so | Formulario de alta | Tú |
| Smithery | Alta con repo; orientado a servidores instalables | Tú (ver nota) |

**Nota sobre Smithery:** su flujo asume un servidor que se instala (npm/Docker) más que un
endpoint remoto alojado. Si pide un paquete, es la señal para decidir si merece la pena un
wrapper `npx` — y esa decisión tiene coste de mantenimiento, así que no la doy por hecha.
El resto de directorios aceptan servidores remotos sin paquete.

## `server.json` para el registro oficial

Preparado en la raíz del repo (`server.json`), contra el esquema **`2025-12-11`**,
verificado el 27/7 en la doc del registro (la primera versión de este fichero llevaba
`2025-07-09`, de memoria, y estaba obsoleta — señal de que este dato caduca). **Validar
igualmente antes de publicar:**

El publisher es un **binario Go** de las releases de `modelcontextprotocol/registry`.
**No** es el paquete `mcp-publisher` de npm, que pertenece a otro proyecto y arranca un
servidor MCP en stdio en vez de autenticar:

```bash
gh release download v1.8.0 --repo modelcontextprotocol/registry   --pattern "mcp-publisher_windows_amd64.tar.gz" --dir /tmp/mcppub
cd /tmp/mcppub && tar xzf mcp-publisher_windows_amd64.tar.gz

./mcp-publisher.exe validate      # SIEMPRE antes de pedir login a nadie
./mcp-publisher.exe login github  # device flow; namespace io.github.JaviMaligno (case-sensitive)
./mcp-publisher.exe publish
```

Si `validate` se queja del esquema, la doc del registro manda sobre este fichero.

## Texto para las fichas

**Descripción corta (una línea):**

> Solar vitamin D calculator: when the sun where you are can actually make vitamin D, for
> your skin type — real solar geometry and live UV data, in 6 languages.

**Descripción media (directorios con párrafo):**

> Vitamin D Explorer answers the questions generic "get 15 minutes of sun" advice cannot:
> whether the sun is currently strong enough where you are, how many minutes *your* skin
> type needs for a target dose, which months of the year synthesis is possible at all at
> your latitude, and how much you made from a session you already did. It runs on real
> solar geometry (NOAA), a Madronich clear-sky UV model with van Heuklon ozone, MED by
> Fitzpatrick type (Holick & Dowdy), and live Open-Meteo UV and cloud data. Six public
> tools need no account; four more read your saved profile, favourite cities and sun
> history over OAuth.

**Por qué es distinto (para el PR a las awesome lists, si piden justificación):** es un
servidor MCP de una app de salud real en producción, con servidor OAuth 2.1 propio
(registro dinámico + PKCE) para las herramientas personales, no un envoltorio de una API
de terceros.

## Entradas para las awesome lists

**`punkpeye/awesome-mcp-servers` — PR enviada** ([#11026](https://github.com/punkpeye/awesome-mcp-servers/pull/11026)).
Categoría real: **Biology, Medicine and Bioinformatics** (no existe una de Health &
Wellness). Emojis según su leyenda: 📇 base de código JavaScript, ☁️ servicio en la nube.
Entrada, en orden alfabético dentro de la categoría y apuntando al repo del paquete:

```markdown
- [JaviMaligno/vitamind-mcp](https://github.com/JaviMaligno/vitamind-mcp) 📇 ☁️ - Solar vitamin D: whether the sun where you are can make vitamin D right now, how many minutes your Fitzpatrick skin type needs for a target dose, which months of the year synthesis is possible at your latitude, and how much a sun session produced. Computed from solar geometry, a clear-sky UV model with ozone and altitude, and live Open-Meteo UV data. `npx vitamind-mcp`
```

Su bot responde automáticamente exigiendo dos cosas antes de aceptar: **ficha en Glama
pasando sus checks** (con Dockerfile añadido en la propia Glama) y el **badge de score**
detrás de la descripción:

```markdown
[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)
```

**`wong2/awesome-mcp-servers` — NO acepta PRs.** Su README lo dice explícitamente: el alta
se hace en el formulario de https://mcpservers.org/submit. Campos: nombre, descripción de
una frase, enlace, categoría (no hay ninguna de salud → *Otros*) y correo de contacto.
Ojo: la opción Premium de $39 lista "enlace dofollow" entre sus ventajas, lo que implica
que **el listado gratuito es nofollow** — sirve para descubrimiento, no para autoridad.

## Detalle que importa para el objetivo

Donde la ficha permita **homepage** además de repo, apuntar a `https://getvitamind.app` o
a `https://getvitamind.app/connect` — **no solo al repo de GitHub**. El enlace tiene que
caer en el dominio que necesita autoridad; un enlace a github.com no le sirve de nada a
getvitamind.app.

`/connect` es mejor destino que la raíz cuando el contexto es "cómo lo conecto": ya existe,
está en el nav, está en los 6 idiomas y explica los pasos por cliente.

## Después de enviar

- Anotar en qué fecha se envió cada uno (los directorios tardan de días a semanas).
- A las ~4 semanas, mirar en Search Console → Enlaces si aparecen dominios nuevos. La
  métrica a batir es **7 enlaces / 2 dominios**.
- No enviar el mismo día que un cambio grande en producción: si el endpoint falla cuando un
  mantenedor lo prueba, la ficha se rechaza y volver a entrar cuesta más que entrar.

---

## Segunda tanda de directorios (2026-08-02)

Los cuatro que faltaban, **verificados en el navegador** — no con `curl`, que Cloudflare
bloquea (ver la lección de Glama arriba).

### Lo primero: quién pasa autoridad y quién no

El objetivo es dominios enlazantes, así que el `rel` decide si merece la pena el trabajo.
Comprobado abriendo una ficha real de cada sitio y leyendo los enlaces salientes:

| Directorio | `rel` del enlace al sitio del proveedor | Sirve para |
|---|---|---|
| **PulseMCP** | *(ninguno)* y `noopener noreferrer` → **dofollow** | Autoridad **y** descubrimiento |
| **Smithery** | `noopener noreferrer` → **dofollow** | Autoridad, y aloja remotos |
| **mcp.so** | `nofollow ugc noopener noreferrer` | Solo descubrimiento |
| mcpservers.org | `nofollow` (verificado el 28/7) | Solo descubrimiento |

`noopener` y `noreferrer` **no** son `nofollow`: no afectan al PageRank. Solo cuenta
`nofollow` (y `ugc`, que Google trata como pista del mismo tipo).

### PulseMCP — nada que enviar, hay que esperar

Su página `/submit` → *MCP Server* no ofrece formulario. Dice literalmente:

> We ingest entries from the Official MCP Registry daily and publish weekly. If it has
> been a week since you published there […] please email hello@pulsemcp.com

Estamos en el registro oficial desde el **27/7**, así que la semana se cumple el **3/8**.
Comprobado el 2/8: `pulsemcp.com/servers?q=vitamind` → *No servers found*.

**Acción:** volver a buscar allí a partir del 3/8. Si sigue sin aparecer, escribir a
`hello@pulsemcp.com` citando `io.github.JaviMaligno/vitamind`. Es el directorio de mayor
valor de los cuatro: dofollow, 22.000 servidores y actualización diaria.

### Smithery — requiere sesión

Publicación por CLI, y pide autenticarse:

```
npx @smithery/cli login          # abre navegador
npx @smithery/cli mcp publish "https://getvitamind.app/api/mcp/mcp" -n javimaligno/vitamind
```

También hay alta por web en `smithery.ai`. Aloja servidores remotos, así que además del
enlace puede traer uso real.

### Cursor Directory — requiere sesión

`cursor.directory/plugins/new` redirige a login con GitHub o Google. El envío es un
formulario de «plugin», no específico de MCP.

### mcp.so — ahora de pago

`nofollow ugc` en el listado normal, y comprobado el 2/8 que **ya no hay envío gratuito**:
la única opción es «Paid submission $39, one-time publishing fee», cuyo reclamo incluye
literalmente *Dofollow project link*. Es decir, el enlace que interesa es justo lo que se
vende. Mismo patrón que el Premium de mcpservers.org.

Decisión del owner. Es el único de la lista que se puede cerrar hoy mismo sin depender de
nadie, pero 39 $ por un enlace de un solo dominio no se justifica solo.

### Textos listos

Las fichas rellenables (descripciones corta/media/larga, endpoints, lista real de
herramientas) están en `docs/mcp-listing-copy.md`, verificadas contra producción el 2/8.
**Ojo: este plan decía «10 herramientas» y hoy son 15** — el dato viejo está en las fichas
ya publicadas y conviene corregirlo al tocarlas.

### Lo que bloquea

Tres de los cuatro piden **iniciar sesión**, y eso lo tiene que hacer el owner: no se
crean cuentas ni se autentica en su nombre. Los datos para rellenarlos están en «Hechos
verificados» más arriba en este mismo documento — no inventar ninguno.
