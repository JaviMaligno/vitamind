# Foundation Sprint · VitaminD Explorer — estado

- **Inicio:** 2026-09-28
- **Rama:** B (producto ya lanzado, gratuito, sin ingresos)
- **Fase actual:** 2 · Diferenciación (fase 1 cerrada; D1 decidida: C′ «la ventana que cambia»)
- **Plataforma ajena:** sí, en parte. El MCP vive dentro de Claude y ChatGPT (Anthropic y OpenAI son también competidores). Se hará la prueba de absorción al cerrar los básicos.
- **Ficheros:** `estado.md`, `basicos.md`, `decisiones.md`

## Pregunta de la sprint (borrador)
¿Hay alguna dirección en la que VitaminD consiga usuarios de verdad y en la que tenga sentido registrarse para algo más que el MCP? ¿O conviene aparcarlo?

## Lo leído (fuentes)
- `vitamind/docs/*`, `CLAUDE.md`, `PRODUCT_HUNT.md`, `docs/superpowers/analysis/2026-08-27-donde-estamos.md`, `docs/partner-research.md`
- `javieraguilar-business/ESTADO.md` §2, `docs/vitamind-*.md`, `data/outreach.csv`
- Investigación web de competencia (2026-09-28): dminder, Sun Day, QSun, D Fetcher, UVLens, SunSmart, AccuWeather en ChatGPT, timeanddate…

## Aplazados
| Qué | Fase de destino |
|---|---|
| Plazo y umbral del experimento C′ (con salida a D) | 6 · Experimentos |
| Aviso por temporada o viaje (ajuste 5 de D1) como forma de retorno | 4 · Enfoque |
| El asistente como requisito de interfaz: ningún eje de la fase 2 puede ser «estar en el asistente» | 2 · Diferenciación |
| App nativa (React Native/Expo) frente a PWA | 4 · Enfoque |
| «Dentro de la IA que ya usas» (MCP/ChatGPT app) como enfoque principal | 4 · Enfoque |
| Aparcar VitaminD (regla del 03-09: si los multiplicadores de salud callan) | 4 · Enfoque |
| Piloto con residencias UK (3 correos sin respuesta, 452 candidatos) | 4 · Enfoque |
| Monetizar el tráfico de horas de sol (98 % de las impresiones) | 4 · Enfoque |

## Datos aportados en la entrevista (2026-09-28)
**analytics_events, últimos 28 días, host = getvitamind.app** (demostrado)

| Evento | Eventos | Personas (id de navegador) |
|---|---|---|
| visit | 629 | 484 |
| install_banner_shown | 37 | 37 |
| city_selected | 7 | 6 |
| gps_denied | 8 | 3 |
| history_override | 32 | 2 |
| prefs_changed | 1 | 1 |

- Ninguna instalación completada, ninguna activación de push, ninguna autenticación.
- Embudo: 484 → 6 eligen ciudad (1,2 %) → 2 usan el historial (0,4 %). De 37 a quienes se ofreció instalar la PWA, 0 la instalaron.
- MCP: el registro empezó el 28/09 a las 13:01 UTC. Solo hay 2 llamadas, ambas de prueba propia. No hay histórico. No se miden las instalaciones del puente npm ni los usuarios únicos.
- **Corregido por el Decider:** amanecer NO concentra las entradas. De 631 visitas: 211 inicio, 161 amanecer (25,5 %), 100 páginas de vitamina D, 38 dashboard, 121 otras.
- `visit` se registra una vez por sesión. No demuestra rebote; demuestra muy poca interacción registrada.
- Recurrencia: 4 navegadores generan 56 visitas de retorno. No se sabe cuántos son pruebas propias (supuesto: al menos uno es el fundador).

## Diagnóstico provisional del Decider (fase 1)
> Hemos construido muchas capacidades sin demostrar una razón suficientemente fuerte para usarlas y volver. La necesidad recurrente y la activación están sin validar; el formato (nativa, PWA, MCP) va después.

Descarta por ahora, por no estar comprobadas: «el problema no duele» y «hace falta app nativa».

## Cliente conocido (entrevista)
- **Único cliente real identificado:** el fundador y su pareja.
- **Uso real:** esporádico. Ya «le tiene cogido el truco» a la regla local. Vuelve a la app cuando tiene dudas o **cuando viaja y pierde la referencia**.
- **Lectura (supuesto):** para quien la usa, el valor es episódico. Se aprende una vez y se vuelve cuando cambia el contexto: viaje, cambio de estación, sitio nuevo. Una herramienta así no genera hábito diario, así que push, historial e instalación empujan contra la naturaleza del uso. Se comprueba preguntando a 5 usuarios potenciales en qué momento concreto lo consultarían.

## Criterio de éxito (entrevista)
- **Éxito:** personas que la usan; el registro vale como métrica. **Misión:** contacto con la naturaleza y una buena relación con el sol. **Tiempo:** unas 3 h/semana.
