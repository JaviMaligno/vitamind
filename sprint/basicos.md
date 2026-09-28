# Fase 1 · Básicos — VitaminD Explorer

Fecha: 2026-09-28 · Rama B (producto lanzado) · Decider: Javier

Leyenda de origen:
- **[M]** material existente (se indica el fichero).
- **[E]** entrevista.
- **[W]** investigación web.

Leyenda de estado:
- **D** demostrado.
- **S** supuesto.

## Criterio de éxito y restricciones [E]
- **Qué cuenta como éxito:** personas que la usan. El registro importa como métrica, no como fin.
- **Misión:** «una vía de contacto con la naturaleza y de vuelta a una buena relación con el sol». Es más amplia que la vitamina D.
- **Tiempo:** unas 3 h/semana.
- **Dinero:** no es el objetivo. Límites:
  - Plan Hobby de Vercel, ya por encima de su cuota de ISR Reads.
  - Hobby prohíbe el uso comercial [M `CLAUDE.md`].

## Cliente
| | Estado | Origen |
|---|---|---|
| El fundador y su pareja. Uso episódico: cuando dudan o viajan y pierden la referencia | D | E |
| 4 navegadores con 56 visitas de retorno (se desconoce cuántos son el fundador) | D/S | E (analytics) |
| Biohackers, carnívoros, senderistas, Europa del norte | S | M `docs/reddit-posts.md`, `docs/community-posts.md` |
| Residencias de mayores UK (comprador: el dueño) | S | M `javieraguilar-business/docs/vitamind-dms-lanzamiento.md` |
| Quien busca «a qué hora amanece en X en mes Y» | D (tráfico), S (necesidad de vitamina D) | M `CLAUDE.md`, `docs/partner-research.md` |

**No hay un cliente externo identificado con nombre** que tome la decisión de forma recurrente.

## Problema
- **Declarado:** no saber cuándo ni cuánto sol hace falta para sintetizar vitamina D donde estás [M `README.md`].
- **Observado:** la regla local se aprende una vez. La duda reaparece al cambiar de contexto (viaje, estación) [E].
- **S:** es un problema de «saber una vez y ajustar», no de «decidir cada día».

## Alternativa actual (competencia indirecta)
- Tomar un suplemento o no hacer nada. **S:** es el competidor real para la mayoría.
- Reglas genéricas: «10–30 min al mediodía», o preguntar a ChatGPT o Claude sin herramientas.
- Mirar el UV en la app del tiempo.

## Ventajas (por qué tú)
| Ventaja | Real o deseo |
|---|---|
| Modelo científico cuidado: UV observado, mediana de 5 modelos de nubes, anclas de literatura en tests [M `CLAUDE.md`] | Real. **S:** el usuario no distingue esa precisión de una regla genérica |
| Web en 6 idiomas; los directos son casi todos solo iOS y en inglés [W] | Real |
| MCP con OAuth, historial y widgets; en ese nicho solo está D Fetcher [W] | Real, pero con 0 uso externo medido |
| Unas 3.300 páginas SEO indexadas [M] | Real, con tráfico de horas de sol y no de vitamina D |
| El fundador construye muy rápido | Real. También es la causa del problema: «mucho producto ≠ validación» [M blog `building-is-no-longer-the-bottleneck`] |

## Competencia
| Nombre | Tipo | Qué hace | Fuente |
|---|---|---|---|
| dminder / D Minder Pro | Directo | Tracker de vitamina D por sol y suplemento, previsión anual. 9,99 $/año, 100–380 K descargas en 10+ años | verificado (https://dminder.info/pricing, https://www.appbrain.com/app/dminder/com.ontometrics.dminder) |
| Sun Day (Dorsey) | Directo | UV, quemadura y síntesis de D con Apple Health. iOS, gratis, open source | verificado (https://github.com/jackjackbits/sunday) |
| QSun | Directo | UV, vitamina D en Pro, 23,99 $/año, sensor | verificado (https://appgrooves.com/app/qsun-uv-index-sun-exposure-and-vitamin-d-tracker-by-comfable-inc) |
| D Fetcher | Directo (web + MCP) | Calculadora web basada en la regla de Holick. Conector MCP en Glama con una herramienta de geocodificación | verificado (https://dfetcher.com/, https://glama.ai/mcp/connectors/com.dfetcher/vitamin-d) |
| SunIQ, RayDay, Helio Track, Sunly, SunSeek… | Directo | Clones 2025–26, casi todos iOS e inglés | verificado que existen; tracción S |
| UV-Derma (AEDV) | Directo/indirecto ES | App de la Academia Española de Dermatología | M `javieraguilar-business/ESTADO.md` |
| UVLens, SunSmart Global UV (OMS) | Indirecto | UV y protección, sin vitamina D | verificado (https://pmc.ncbi.nlm.nih.gov/articles/PMC12020481/, https://www.who.int/tools/sunsmart-global-uv-app) |
| Apple Weather / Google | Indirecto | UV horario de serie | verificado (https://developer.apple.com/weatherkit/) |
| Apple Watch Time in Daylight | Indirecto | Mide automáticamente el tiempo pasado con luz de día (no UV) | verificado (https://support.apple.com/guide/watch/see-time-in-daylight-apd3ab22534c/watchos) |
| Suplementos | Sustituto | Pastilla barata, sin pensar | S |
| AccuWeather en ChatGPT | Indirecto (asistente) | Tiempo y UV dentro de ChatGPT | verificado (https://www.accuweather.com/en/press/accuweather-launches-first-of-a-kind-weather-app-in-chatgpt/1875980) |
| **Anthropic / OpenAI (plataforma anfitriona del MCP)** | Anfitriona | Búsqueda, código e integración con Apple Health de serie | ver prueba de absorción |
| timeanddate, sunrise-sunset.org, salidapuestasol… | SEO (horas de sol) | Horas de amanecer y atardecer | verificado (https://www.similarweb.com/website/timeanddate.com/) |

## Lo demostrado (rama B)
| Dato | Valor | Fuente |
|---|---|---|
| Visitantes en 28 días | 484 navegadores, 631 visitas | E (analytics_events) |
| Entrada | 211 inicio, 161 amanecer, 100 vitamina D, 38 dashboard, 121 otras | E |
| Activación | 6 eligen ciudad, 2 usan el historial | E |
| Instalación, push, cuenta | 0, 0, 0 (banner mostrado 37 veces) | E |
| Recurrencia | 4 navegadores, 56 retornos | E |
| MCP | 0 llamadas externas desde el 28/09 13:01 UTC; sin histórico | E |
| npm vitamind-mcp | 0 descargas | M `ESTADO.md` |
| Product Hunt | #154, 2 puntos, 1 visita | M `ESTADO.md` |
| Perfiles | 7, uno del fundador | M `donde-estamos.md` |
| Partners | MARNYS y otro: «vuelve cuando tengas usuarios». Resto sin respuesta | M `partner-research.md`, `vitamind-marnys-historial.md` |
| SEO | Caída de 1.825 a 18 impresiones/día por el commit b5ef203; restaurado el 22/09, recuperación sin medir | M `CLAUDE.md` |

## Diagnóstico del Decider [E]
> Muchas capacidades sin demostrar una razón fuerte para usarlas y volver. La necesidad recurrente y la activación están sin validar; el formato va después.

## Supuestos y la forma más barata de comprobarlos
| # | Supuesto | Cómo comprobarlo |
|---|---|---|
| S1 | El uso natural es episódico (viaje, estación, duda), no diario | 5 entrevistas: «¿cuándo fue la última vez que te preguntaste cuánto sol necesitas?» |
| S2 | Hay personas fuera del fundador con esa duda | Contar cuántas de las 484 personas hacen algo más que leer; 5 conversaciones con conocidos que suplementan |
| S3 | La precisión del modelo le importa al usuario frente a una regla genérica | Enseñar a 5 personas la respuesta genérica de un chatbot junto a la de VitaminD, y preguntar cuál usarían |
| S4 | El tráfico de amanecer contiene gente con la necesidad de vitamina D | Clics de amanecer a vitamina D en analytics (estimado en 1,3 %, sin verificar) |
| S5 | Un asistente (MCP) es el formato natural para uso episódico | Prueba de absorción y 5 personas que usen Claude o ChatGPT |
| S6 | La misión «buena relación con el sol» atrae a más gente que «vitamina D» | Comparar el CTR o la conversión de dos titulares en la home |
| S7 | El suplemento es el competidor real | Entrevistas (S1) |

**Supuestos sobre el total de piezas:** del cliente, el problema, la alternativa y el valor para el usuario, solo el cliente-fundador y el uso episódico están demostrados. **Alrededor del 75 % son supuestos.**

## Riesgos propios y lentes específicas
1. **Uso episódico.** La herramienta se aprende y se abandona; la retención es estructuralmente baja. → **Lente de frecuencia:** ¿qué opción crea un motivo real para volver, o encaja con volver poco?
2. **Tiempo del fundador (3 h/semana) frente a su tendencia a construir.** → **Lente de foco:** ¿qué opción se puede sostener con 3 h/semana sin construir nada nuevo durante semanas?
3. **Salud y regulación.** Los health claims (Reglamento UE 432/2012) limitan el mensaje y alejan a partners y divulgadores. → **Lente de confianza:** ¿qué opción gana credibilidad sanitaria sin prometer de más?
4. **Infraestructura.** Hobby se ha pasado de cuota de lecturas y prohíbe el uso comercial; un pausado da 503 en todo el SEO. Se tiene en cuenta en la lente pragmática.

## Prueba de absorción (2026-09-28)
Plataformas evaluadas: Anthropic, OpenAI, Google y Apple.

**(a) Canal asistente (MCP): riesgo ALTO, 0–12 meses.**
- **Parte expuesta:** la pregunta episódica «¿cuántos minutos hoy?», que es justo el uso real observado. Tres cosas la cubren sin nosotros:
  - El modelo base ya responde con el orden de magnitud correcto.
  - El UV ya llega dentro del asistente: AccuWeather en ChatGPT desde el 24/03/2026 (verificado, https://www.accuweather.com/en/press/accuweather-launches-first-of-a-kind-weather-app-in-chatgpt/1875980), además de la búsqueda.
  - Los conectores de salud dan el perfil: Claude con Apple Health desde el 22/01/2026 (verificado, https://www.macrumors.com/2026/01/22/claude-ai-adds-apple-health-connectivity/) y ChatGPT Health con Apple Health desde el 23/07/2026 (verificado, https://www.macrumors.com/2026/07/23/chatgpt-apple-health-integration/).
- **Prueba práctica, Madrid a las 13:00, fototipo III, cara y brazos:**
  - Respuesta genérica sin herramienta: 10–20 minutos, unas 1.000 UI.
  - Respuesta de `estimate_sun_session`: 15 minutos, UV 5,5, unas 1.004 UI y quemadura a los 55 minutos.
  - Para el usuario medio, la respuesta genérica es suficientemente buena.
- **Sobrevive:**
  - El historial y el registro personal usados desde varios asistentes.
  - Los casos límite donde la heurística falla: invierno, latitudes altas, nubes reales, la ventana exacta con UV de 3 o más, los viajes.

**(b) Web/PWA: riesgo MEDIO, con dos mitades.**
- **Horas de amanecer y atardecer (SEO): riesgo ALTO, ya ocurre.** Google responde en la propia página de resultados (verificado, https://developers.google.com/maps/documentation/weather/hourly-forecast). Es el 98 % de las impresiones en Search Console, aunque solo el 25,5 % de las entradas medidas.
- **Calculadora de vitamina D: riesgo BAJO en 12–24 meses.**
  - Apple, Google y OpenAI evitan dar cifras médicas de síntesis. **S:** por la exposición regulatoria.
  - iOS 27 y watchOS 27 no traen nada de sol (verificado, https://www.dcrainmaker.com/2026/06/apple-watchos27-new-features-detailed.html).
  - La competencia real son terceros, como Sola en el Apple Watch (verificado, https://getsola.com/apple-watch/).

**Consecuencia:** el riesgo es alto en el canal que el Decider proponía como dirección («meterlo en la IA que ya usa la gente»). Antes de la fase 2 se decide con la Apuesta ciega.

## Crítica de la fase
- **No hay cliente externo demostrado.** El único usuario con uso real es el fundador, y lo usa poco. Si las entrevistas de S1 y S2 no encuentran a nadie con la duda recurrente, el producto no tiene sentido como producto: queda como una herramienta personal y un caso de portfolio. Sería un resultado legítimo.
- **La misión y el producto no coinciden.** La misión es «buena relación con el sol y la naturaleza», pero el producto es una calculadora de vitamina D, un nicho de salud con restricciones regulatorias y un sustituto barato (la pastilla). Puede que el cliente esté en la misión y no en la vitamina D, o al revés.
- **El tráfico que sí llega (horas de sol) no pide vitamina D.** Monetizarlo o convertirlo exige una razón que hoy no existe en la página.
- **Construir es el hábito del fundador.** La respuesta «construyamos X» (nativa, más herramientas MCP) ya ha fallado varias veces según los datos. Cualquier dirección que empiece construyendo parte con sospecha.
