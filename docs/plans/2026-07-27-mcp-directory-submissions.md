# Plan: publicar el MCP en directorios (bloque C del plan del 19/7)

**Fecha:** 2026-07-27
**Estado:** artefactos preparados; los envíos los hace el usuario.
**Contexto:** el bloque C de `docs/plans/2026-07-19-mcp-evolution-account-marketing.md`
("Directorios MCP: enviar el conector al registry y directorios cuando esté estable en
producción"). El servidor lleva estable desde el 19-20/7.

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
| Registro MCP oficial | `server.json` + CLI `mcp-publisher` + login GitHub para el namespace `io.github.javimaligno` | Tú (login) |
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

```bash
# instalar el publisher (comprobar el nombre actual en la doc del registro)
mcp-publisher validate      # valida server.json contra el esquema
mcp-publisher login github  # autentica el namespace io.github.javimaligno
mcp-publisher publish
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

**Verificar el formato exacto en el README de cada repo antes de abrir el PR** — cada lista
tiene su convención de emoji de lenguaje/ámbito y su orden alfabético por categoría.

Formato típico de `punkpeye/awesome-mcp-servers` (categoría *Health & Wellness*), donde
🌐 = servicio remoto y ☁️ = cloud:

```markdown
- [JaviMaligno/vitamind](https://github.com/JaviMaligno/vitamind) 🌐 ☁️ - Solar vitamin D calculator: synthesis windows, minutes needed by Fitzpatrick skin type, year-round viability by latitude, and sun-session estimates from live UV data.
```

Formato típico de `wong2/awesome-mcp-servers`:

```markdown
- [Vitamin D Explorer](https://getvitamind.app/connect) - When the sun where you are can actually make vitamin D, for your skin type. Real solar geometry and live UV data; 6 public tools, plus personal tools over OAuth.
```

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
