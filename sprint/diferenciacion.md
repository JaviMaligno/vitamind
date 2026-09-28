# Fase 2 · Diferenciación — VitaminD Explorer

Fecha: 2026-09-28.

Cliente (D1): personas en latitudes medias durante las estaciones de transición, cuando la ventana se estrecha, se ensancha o se cierra, y viajeros. **Estar en el asistente es un requisito, no un eje.**

## 1. Note: candidatos
Cuatro rivales han trabajado por separado:
- La clienta escéptica: «Marta, 41, Zaragoza, vitamina D baja, ampolla, ChatGPT».
- El analista de competencia, con búsqueda web.
- El facilitador experto en sprints.
- El contrarian.

Propusieron 16 pares, que quedan en 8 candidatos distintos:

| # | Par (malo ↔ bueno) | Lo propusieron | Materialización |
|---|---|---|---|
| C1 | Foto del instante ↔ Trayectoria de la ventana (fechas de cierre y reapertura, ritmo) | facilitador, analista, contrarian | «Se cierra hacia el 18 de noviembre y reabre hacia el 20 de febrero; pierdes unos 5 min/semana» |
| C2 | Alerta diaria ↔ Un aviso solo cuando cambia tu ventana | Marta, contrarian, facilitador, analista | 2–3 avisos al año («se cierra en 2 semanas», «ha reabierto») y uno antes de viajar |
| C3 | Regla genérica ↔ Dónde falla la regla en tu caso | Marta, contrarian, analista | «La regla dice 10–20 min. Aquí, hoy, son 38. En diciembre ninguno basta» |
| C4 | Un lugar ↔ Origen frente a destino | contrarian, analista | «Madrid → Bangkok, fototipo II: allí 7 min y tope en 22; en casa, 35» |
| C5 | Solo el mínimo ↔ Ventana completa (mínimo eficaz y tope antes del eritema) | facilitador, contrarian | Una barra de mínimo a tope |
| C6 | Cielo teórico ↔ Cielo real | facilitador | UV observado y mediana de 5 modelos de nubes |
| C7 | Otra app y cuenta ↔ Nada que instalar ni registrar | Marta | Un enlace desde Google o ChatGPT, sin pedir datos |
| C8 | Suena a biohacking ↔ Sobrio y alineado con mi médica | Marta | Admite los límites, cita fuentes, sin gamificación |

## 2. Verificación y clasificación
Cada candidato se ha comprobado contra al menos dos competidores. El proxy bloqueó el acceso directo a casi todas las fuentes, así que la mayoría de lo verificado sale del texto que el buscador devuelve de la propia URL.

| # | Quién ya lo cubre | Clasificación |
|---|---|---|
| C1 | dminder tiene «annual solar forecast… what days of the year D will be available» y «when your next D opportunity will be» (verificado, snippet de dminder.ontometrics.com/features.html). RayDay tiene un «year-view calendar showing when winter shuts the D-Window» (verificado, snippet de apps.apple.com/us/app/rayday-vitamin-d-tracker/id6761286896). D Fetcher da los meses con síntesis (verificado, snippet de glama.ai/mcp/connectors/com.dfetcher/vitamin-d) | **Cae → REQUISITO.** Ya existe en tres competidores. El «ritmo» en min/semana no lo tiene nadie (supuesto), pero es un matiz, no un eje |
| C2 | RayDay: «heads-up when winter's first D-Window returns» (verificado, snippet del App Store). dminder avisa cuando se puede sintetizar ese día, no del cambio de estación (verificado, snippet de features.html). Sola, QSun, Sun Day, UV-Derma y D Fetcher no | **DIFERENCIADOR FRÁGIL.** RayDay cubre la reapertura; el aviso de cierre y el de antes de un viaje siguen libres (supuesto). Apple o Google podrían absorberlo |
| C3 | Nadie contrasta la regla genérica con el cálculo propio (supuesto por ausencia). UV-Derma da minutos por fototipo en verano e invierno, sin contrastar con nada (verificado, snippet de aedv.fundacionpielsana.es) | **DIFERENCIADOR FRÁGIL.** Nadie lo hace, pero ChatGPT o Google podrían copiarlo con un prompt. Diferencia por mensaje y confianza, no es un foso |
| C4 | dminder usa el lugar actual, sin comparar (verificado, snippet de features.html). D Fetcher calcula un lugar por llamada (verificado, snippet de glama.ai). El resto no consta. VitaminD ya tiene `compare_vitamin_d_year` | **DIFERENCIADOR.** De nicho (viajeros). El foso es la precisión del cálculo, no la función |
| C5 | UV-Derma contrapone eritema y dosis de vitamina D (verificado, aedv.fundacionpielsana.es/prevencion/uv-derma-eritema-cutaneo-vs-dosis-saludable-de-vitamina-d/). D Fetcher da la MED (verificado, snippet de glama.ai) | **Cae → REQUISITO** (confianza sanitaria) |
| C6 | D Fetcher usa nubosidad prevista (verificado, snippet de glama.ai). Cualquiera puede decir que lo hace | **Cae → REQUISITO** |
| C7 | D Fetcher es web. ChatGPT y la app del tiempo ya están instalados | **Cae → REQUISITO** (va con la interfaz) |
| C8 | Es tono y cualquiera lo copia | **Cae → REQUISITO** (confianza) |

**Competidor nuevo detectado:** RayDay (iOS). Toca de lleno C1 y C2.

## Requisitos bloqueantes (no son ejes; hay que cumplirlos)
- R1 · Estar dentro del asistente (D1) y en la web, sin instalar nada ni registrarse para la respuesta básica (C7).
- R2 · Ventana completa: mínimo eficaz y tope antes del eritema, sin prometer UI (C5).
- R3 · Cielo real (C6).
- R4 · Tono sobrio y alineado con la medicina, que admita los límites (C8).
- R5 · Vista anual de la ventana, con cuándo se cierra y cuándo reabre (C1).

## 3. Diferenciadores que pasan a votación
C2 · Aviso cuando cambia. C3 · Dónde falla la regla. C4 · Origen frente a destino.

## 4. Votación y decisión
Pendiente.

## Crítica (hasta ahora)
- **De los 8 candidatos solo sobreviven 3, y dos son frágiles.** C2 ya lo cubre a medias RayDay. C3 es copiable con un prompt. VitaminD no tiene hoy un foso técnico; como mucho, tiene un encuadre que nadie usa.
- **Lo más sólido que tiene el producto se ha ido a requisitos:** la precisión, el cielo real y la ventana completa. Invertir más en precisión no diferencia.
- **C4 es el más defendible, pero también el más de nicho.** Los viajeros llegan una vez por viaje.
- **Si el 2x2 queda como C2 × C3, VitaminD solo gana por mensaje y por un aviso.** Hay que probar con personas reales que ese aviso lo quieren, que es el ajuste 4 de D1. Si no, no hay diferenciación suficiente.
