# QA Plan — MCP Apps widgets (issue #23)

**Date:** 2026-07-30
**Source spec:** `docs/plans/2026-07-29-mcp-apps-and-spec-migration.md` (part A) + issue #23
**Target deployment:** parameterised — see *Deployments* below
**Test account(s):** a VitaminD account with some sun history, connected via the OAuth connector
**Screenshots root:** `docs/qa-evidence/<YYYY-MM-DD>/screenshots/`

**Notation**
- ✅ pasa funcional + UX OK
- ⚠️ pasa funcional, observación UX
- ❌ no pasa
- 🔄 pendiente de ejecutar
- ➖ no aplica en este entorno

---

## Deployments

Everything below is written once and run once per environment. Substitute `<BASE>`:

| Entorno | `<BASE>` | Cuándo |
|---|---|---|
| **dev** | `https://getvitamind-dev.vercel.app` | Tras cada merge a `dev` |
| **prod** | `https://getvitamind.app` | Tras promover a `master`, antes de anunciar nada |

Conectores MCP, en cualquiera de los dos:

| Conector | URL | Widgets que cubre |
|---|---|---|
| **Público** | `<BASE>/api/mcp/mcp` | W1, W2, W3, W4 (en modo solo-contexto) |
| **Cuenta (OAuth)** | `<BASE>/api/mcp-auth/mcp` | los cuatro anteriores + W5, y W4 con guardado |

> **Antes de empezar, si vienes de una sesión anterior**: desconecta y reconecta el conector de cuenta. El permiso `profile:write` se añadió el 2026-07-30 y **los tokens anteriores no lo tienen**; sin reconectar, W4 dirá «solo para esta conversación» y estará en lo cierto. Ver issue #28.

---

## Cross-cutting conventions (aplican a TODAS las secciones)

1. **El widget es aditivo, nunca sustituye al texto.** En toda respuesta con widget, el texto del asistente debe seguir contestando la pregunta por sí solo. Si el texto empeora o desaparece, es un fallo aunque el dibujo sea bonito.
2. **Idioma**: lo decide el **cliente**, no la app. Ver *Matriz de idiomas*. El perfil de VitaminD no influye.
3. **Tema**: el widget sigue el tema del host. Nunca debe quedar texto ilegible (claro sobre claro, oscuro sobre oscuro).
4. **Sin peticiones externas**: el widget es un HTML autocontenido. En la consola del cliente no debe aparecer ningún intento de cargar script, fuente o imagen externa.
5. **Nada de códigos crudos**: cualquier estado de error se explica con palabras (p. ej. «conecta tu cuenta»), no con `authentication_required`.
6. **Todo indicador de color lleva su leyenda o su etiqueta.** Si aparece un color nuevo sin explicación en pantalla, es una observación UX.
7. **Tiempos**: un control que responde a un toque debe reaccionar visiblemente en menos de ~300 ms, aunque el servidor tarde más.

---

## Matriz de idiomas

El idioma de las etiquetas sale de `ctx.locale`, que **manda el cliente** (Claude), no del perfil de la app ni del último idioma usado en la web. Para cambiarlo, cambia el idioma **de Claude** y vuelve a preguntar.

| Locale del host | Meses esperados (W1/W5) | Veredicto esperado (W3) |
|---|---|---|
| `es` | ene, feb, mar… | «Ahora mismo hay buen sol» |
| `en` | Jan, Feb, Mar… | "Good sun right now" |
| `fr` | janv., févr., mars… | «Bon soleil en ce moment» |
| `de` | Jan., Feb., März… | «Gerade jetzt gute Sonne» |
| `ru` | янв., февр., март… | «Прямо сейчас хорошее солнце» |
| `lt` | saus., vas., kov.… | «Dabar saulė tinkama» |
| cualquier otro (p. ej. `pt`, `zh`) | **inglés** | **inglés** |

**Cobertura mínima por ronda**: `es` y `en` siempre; un tercero rotatorio (`fr`, `de`, `ru`, `lt`) y **un no soportado** para confirmar el respaldo a inglés. La ronda completa de seis solo hace falta al tocar textos.

⚠️ **Matiz esperado, no es fallo**: el texto que lee el modelo va **siempre en inglés** (los payloads de los tools lo son) y el modelo responde en el idioma de la conversación. Así que la prosa de Claude y las etiquetas del widget vienen de fuentes distintas. Normalmente coinciden; si no lo hacen, anótalo como observación, no como error.

---

## W1 — Tira del año (`get_vitamin_d_year`)

**Verbatim spec**:
> Today this returns 12 month objects plus summary fields, and the model has to narrate it. […] The year strip shows the season edges honestly and instantly.

**Entregado**: commit `32a0c9e`, recurso `ui://getvitamind/year-strip.html`.

**Pre-condiciones**: conector público conectado. Ninguna cuenta necesaria.

**Pasos**:
1. Pregunta: **«¿En qué meses puedo generar vitamina D con el sol en Reikiavik?»**
2. **[screenshot 1]** La respuesta completa: texto del asistente + tira.
3. Repite con **Singapur** para ver el caso contrario (todo el año).
4. **[screenshot 2]** La tira de Singapur.

**Resultado esperado (funcional)**:
- Aparece una tira de 365 columnas bajo la respuesta.
- Reikiavik: 5 meses, temporada del **30 abr al 23 ago**; la mayoría de la tira, oscura.
- Singapur: **todo el año**, franja naranja uniforme.
- El texto del asistente responde la pregunta aunque tapes el dibujo.

**Checks UX**:
- Las etiquetas de mes se leen y no se solapan en el ancho del chat.
- La leyenda (0 h → 10 h+) es visible y se entiende sin el spec delante.
- El degradado distingue meses buenos de malos **sin depender solo del color** (un daltónico debería ver el cambio de luminosidad).

**Screenshots a capturar**:
- `w1-01-reikiavik-tira.png`
- `w1-02-singapur-tira.png`

**Status**: 🔄

---

## W2 — Comparativa de ciudades (`compare_vitamin_d_year`)

**Verbatim spec**:
> The one case where the chat beats the app outright. […] the widget stacks the strips on a shared axis.

**Entregado**: commit `873df38`. Reutiliza el recurso de W1.

**Pre-condiciones**: conector público.

**Pasos**:
1. Pregunta: **«Compara Reikiavik, Madrid y Singapur: ¿dónde hay sol de invierno de verdad?»**
2. **[screenshot 1]** El widget completo con las tres tiras.
3. Pide una cuarta y una quinta ciudad en la misma conversación (p. ej. «añade Oslo y Sídney»).
4. **[screenshot 2]** El widget con cinco.

**Resultado esperado (funcional)**:
- **Un solo widget** con tres tiras apiladas, no tres widgets sueltos.
- **Un único eje de meses y una única leyenda** para toda la pila.
- Cada tira lleva su nombre de ciudad y su temporada (p. ej. `04-30 → 08-23`).
- El texto del asistente ordena las ciudades correctamente: Singapur > Madrid > Reikiavik.
- Con cinco ciudades sigue siendo legible; con más de cinco el tool debe rechazar o recortar, no romperse.

**Checks UX**:
- Las tiras encogen al apilarse (56 px) y siguen distinguiéndose entre sí.
- Un nombre de ciudad largo no descuadra la fila ni empuja la temporada fuera de pantalla.

**⚠️ Fallo conocido a vigilar**: si salen **tres widgets separados**, el modelo ha llamado tres veces a `get_vitamin_d_year` en lugar de a `compare_vitamin_d_year`. Anótalo: es un problema de descripción del tool, no del widget.

**Screenshots a capturar**:
- `w2-01-tres-ciudades.png`
- `w2-02-cinco-ciudades.png`

**Status**: 🔄

---

## W3 — Ventana de hoy (`get_current_status`)

**Verbatim spec**:
> This is the app's core question and the answer that reads worst as text: a state enum, a UV number, minutes needed, a window start/end, a countdown.

**Entregado**: commit `ef50d8a`, recurso `ui://getvitamind/day-curve.html`.

**Pre-condiciones**: conector público. **Ojo con la hora**: el veredicto y su color dependen del momento en que preguntes.

**Pasos**:
1. Pregunta: **«¿Es buen momento ahora para tomar el sol en Madrid?»**
2. **[screenshot 1]** El widget entero.
3. Si es posible, repite a otra hora del día (o con una ciudad en otro huso, p. ej. Sídney) para ver un estado distinto.
4. **[screenshot 2]** El segundo estado.

**Resultado esperado (funcional)**:
- Veredicto grande arriba, coherente con la hora: sol útil / aún no / ya cerró / hoy no.
- Curva del día dibujada, con la **banda viable sombreada** y la **línea de puntos del umbral**.
- **Línea vertical marcando la hora actual**, en la posición que le toca.
- Bajo la curva: índice UV, minutos necesarios, ventana y nubosidad.

**Checks UX**:
- El color del veredicto cambia con el estado (ámbar / azul / gris) y **no es la única señal**: el texto lo dice.
- Las etiquetas de hora (00, 06, 12, 18, 24) se leen y la primera y la última no se salen del lienzo.
- Si no hay ventana ese día, el widget lo dice en palabras en vez de dibujar una curva vacía sin explicación.

**Screenshots a capturar**:
- `w3-01-estado-<good|upcoming|closed>.png`
- `w3-02-estado-alternativo.png`

**Status**: 🔄

---

## W4 — Selector de perfil (`configure_sun_profile`)

**Verbatim spec**:
> Skin type, exposed-skin fraction, age and target IU currently arrive through conversational back-and-forth or not at all, and every calculation silently falls back to defaults.

**Entregado**: commits `573f95a` (formulario) y `ce9c81e` (guardado en cuenta). Recurso `ui://getvitamind/profile.html`.

**Pre-condiciones**:
- **Pasada A**: conector **público**.
- **Pasada B**: conector **de cuenta**, reconectado tras el 2026-07-30 (ver aviso arriba).

**Pasos**:
1. Pregunta: **«Ayúdame a configurar mi perfil solar para Barcelona.»**
2. **[screenshot 1]** El formulario recién abierto, con los valores por defecto.
3. Toca un tipo de piel distinto y un preset de exposición. Observa los minutos.
4. **[screenshot 2]** Tras los cambios, con el estado de guardado visible.
5. En la misma conversación, pregunta: **«¿y cuántos minutos necesitaría en Oslo?»**
6. **[screenshot 3]** La respuesta, para comprobar qué perfil ha usado el modelo.
7. *(Solo pasada B)* Abre `<BASE>` en el navegador → tu perfil.
8. **[screenshot 4]** El perfil de la app con el valor cambiado.

**Resultado esperado (funcional)**:
- Seis muestras de piel, cuatro presets de exposición, campo de edad y cuatro objetivos IU.
- Los minutos se recalculan **al instante** al tocar, sin indicador de carga.
- El asistente, en la pregunta de seguimiento, usa el perfil elegido y no los valores por defecto.
- **Pasada A**: el widget rotula «Solo para esta conversación» y **no** ofrece guardado.
- **Pasada B**: aparece «Guardando…» y luego «Guardado en tu cuenta», y el valor **se ve cambiado en la app**.

**Checks UX**:
- La opción seleccionada de cada grupo se distingue sin ambigüedad (una sola por grupo).
- Las muestras de piel se entienden como tipos de piel y no como una paleta decorativa; el texto de ayuda («1 se quema fácil · 6 rara vez») está visible.
- Si el UV del lugar es demasiado bajo, dice «UV insuficiente para sintetizar» en vez de un número inventado.
- El estado de guardado no miente: si falla, lo dice.

**Screenshots a capturar**:
- `w4-01-formulario-inicial.png`
- `w4-02-tras-cambios-<publico|cuenta>.png`
- `w4-03-seguimiento-usa-perfil.png`
- `w4-04-perfil-en-la-app.png` *(solo pasada B)*

**Status**: 🔄

---

## W5 — Historial de sol (`get_my_history`) — conector de cuenta

**Verbatim spec**:
> It is the natural place to demonstrate bidirectional widgets — tapping a day calls `log_sun_session` and the calendar updates in place, without a chat round-trip.

**Entregado**: commits `573f95a` (calendario) y `6c8c9cd` (tres estados, números de día, leyenda). Recurso `ui://getvitamind/history.html`.

**Pre-condiciones**:
- Cuenta con **algo de historial** (si está vacío solo se puede probar el estado vacío).
- **Pasada A**: conector **de cuenta**.
- **Pasada B**: conector **público** — para el estado sin sesión.

**Pasos**:
1. Pregunta: **«Enséñame mi historial de sol de las últimas semanas.»**
2. **[screenshot 1]** El calendario completo, con cabecera, leyenda y rango.
3. Toca un día **con sol** una vez. Observa el pulso y el resultado.
4. Tócalo por segunda y tercera vez.
5. **[screenshot 2]** El día tras las tres pulsaciones.
6. Intenta tocar un día **sin sol útil** (color apagado).
7. Abre `<BASE>` → panel → calendario y busca el mismo día.
8. **[screenshot 3]** El calendario de la app, con el día en el mismo estado.
9. *(Pasada B)* Repite el paso 1 con el conector público.
10. **[screenshot 4]** El estado «conecta tu cuenta».

**Resultado esperado (funcional)**:
- Cada casilla muestra **su número de día**; el día 1 muestra el **nombre del mes**.
- Arriba: el **rango** («30 jul – 1 ago») y la racha.
- Leyenda de cuatro colores visible.
- El toque cicla: **salí → no salí → sin respuesta**, y el cambio persiste al volver a preguntar.
- Los días sin sol útil **no responden** al toque.
- El estado del día coincide con el del calendario de la app.
- **Pasada B**: mensaje «conecta tu cuenta», **no** una rejilla vacía.

**Checks UX**:
- El número de día se lee sobre los cuatro fondos (confirmado, no salí, hubo sol, sin sol).
- El estado pendiente se distingue de un día normal (pulso, número oculto).
- «No salí» se lee como un dato, **no como un reproche**: neutro con contorno, nunca rojo.
- El pie explica el ciclo de tres estados, y coincide con lo que hace el toque.

**Screenshots a capturar**:
- `w5-01-calendario-completo.png`
- `w5-02-ciclo-tres-estados.png`
- `w5-03-mismo-dia-en-la-app.png`
- `w5-04-sin-cuenta.png`

**Status**: 🔄

---

## N1 — Controles negativos (no deben dibujar nada)

**Por qué**: cinco de trece herramientas llevan widget. Que las otras ocho **no** dibujen es tan deliberado como que las cinco lo hagan — sus respuestas son dos números o una lista, y una imagen no aportaría nada. Un widget que aparece donde no debe es un fallo.

**Pasos**:
1. **«¿Cuánta vitamina D genero en 20 minutos en Valencia?»** → `estimate_sun_session`
2. **«¿A qué hora amanece mañana en Bilbao?»** → `get_sun_times`
3. **«Busca la ciudad de Oporto»** → `search_city`
4. **«¿Cuál es mi ventana de vitamina D el 15 de agosto en Sevilla?»** → `get_vitamin_d_window`
5. **[screenshot 1]** Las cuatro respuestas.

**Resultado esperado**: ninguna dibuja widget, y las cuatro responden bien en texto.

**Screenshots**: `n1-01-controles-negativos.png`

**Status**: 🔄

---

## S1 — Smoke transversal: idioma y tema

**Por qué**: el host manda el idioma y el tema **por separado**, y solo envía el campo que cambia. Una implementación ingenua perdería el idioma al cambiar el tema. Es el caso que más cerca estuvo de romperse.

**Pasos**:
1. Con cualquier widget en pantalla, cambia el tema de Claude de claro a oscuro.
2. **[screenshot 1]** El mismo widget en oscuro.
3. Sin recargar, comprueba que los meses/etiquetas **siguen en el idioma anterior**.
4. Cambia el idioma de Claude y repite una pregunta de W1.
5. **[screenshot 2]** El widget en el idioma nuevo.
6. Pon el cliente en un idioma **no soportado** (p. ej. portugués) y repite.
7. **[screenshot 3]** El widget, que debe caer a inglés.

**Resultado esperado**:
- El widget se recolorea y **conserva el idioma**.
- Ningún texto queda ilegible en ninguno de los dos temas.
- Idioma no soportado → inglés, no cadenas vacías ni claves sin traducir.

**Screenshots**: `s1-01-tema-oscuro.png`, `s1-02-idioma-<locale>.png`, `s1-03-fallback-ingles.png`

**Status**: 🔄

---

## S2 — Smoke transversal: el texto no cambia para clientes sin UI

**Por qué**: la promesa central del diseño. Un cliente MCP sin soporte de widgets debe recibir exactamente lo que recibía antes.

**Pasos** (no requiere cliente gráfico; se puede hacer con `curl`):
1. `initialize` contra `<BASE>/api/mcp/mcp`.
2. `tools/list` → contar herramientas y cuáles llevan `_meta.ui`.
3. `tools/call` de `get_vitamin_d_year` → inspeccionar `content[0].text`.

**Resultado esperado**:
- **13 herramientas**, exactamente **5** con `_meta.ui`.
- El texto **no** contiene `hoursByDay` ni ningún array de gráfico.
- `structuredContent` ausente.
- `resources/read` de cada recurso `ui://` devuelve HTML autocontenido (sin `<script src=`, sin `<link href=`).

**Screenshots**: no aplica; pega la salida en el informe.

**Status**: 🔄

---

## Resumen final esperado (placeholder a rellenar tras ejecutar)

**Entorno**: `<dev|prod>` · **Idioma del host**: `<locale>` · **Fecha**: `<YYYY-MM-DD>`

| ID | Status | Observación |
|----|--------|-------------|
| W1 | 🔄 | |
| W2 | 🔄 | |
| W3 | 🔄 | |
| W4 (público) | 🔄 | |
| W4 (cuenta) | 🔄 | |
| W5 (cuenta) | 🔄 | |
| W5 (sin cuenta) | 🔄 | |
| N1 | 🔄 | |
| S1 | 🔄 | |
| S2 | 🔄 | |

**Bugs encontrados fuera del plan** (los que aparecen mientras verificas y no estaban previstos):

| # | Dónde | Qué pasó | Severidad |
|---|---|---|---|
| | | | |
