# Foundation Sprint · VitaminD Explorer — estado

- **Inicio:** 2026-09-28
- **Rama:** B (producto ya lanzado, gratuito, sin ingresos)
- **Fase actual:** 1 · Entrevista y básicos (lectura del material hecha; entrevista en curso)
- **Plataforma ajena:** sí, en parte. El MCP vive dentro de Claude y ChatGPT (Anthropic y OpenAI son también competidores). Se hará la prueba de absorción al cerrar los básicos.
- **Ficheros:** `estado.md`

## Pregunta de la sprint (borrador)
¿Hay alguna dirección en la que VitaminD consiga usuarios de verdad y en la que tenga sentido registrarse para algo más que el MCP? ¿O conviene aparcarlo?

## Lo leído (fuentes)
- `vitamind/docs/*`, `CLAUDE.md`, `PRODUCT_HUNT.md`, `docs/superpowers/analysis/2026-08-27-donde-estamos.md`, `docs/partner-research.md`
- `javieraguilar-business/ESTADO.md` §2, `docs/vitamind-*.md`, `data/outreach.csv`
- Investigación web de competencia (2026-09-28): dminder, Sun Day, QSun, D Fetcher, UVLens, SunSmart, AccuWeather en ChatGPT, timeanddate…

## Aplazados
| Qué | Fase de destino |
|---|---|
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
