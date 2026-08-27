# Método de captura — esquema v2

Escrito el 2026-08-27, después de que el instrumento fallara en responder la pregunta
para la que se construyó.

## Qué salió mal con el v1

El seguimiento se diseñó para medir **si nos citan dentro del AI Overview**. Mide eso bien.
Pero se ha usado para contestar otra pregunta —**por qué el CTR es del 0,3 %**— y para eso
le faltan tres campos, y la falta produjo una conclusión demasiado fuerte.

`2026-08-14-pattern-study-results.json` concluye «the AI Overview is NOT the mechanism»,
apoyándose en `sun-toronto-aug`: sin AIO y sin clics. El razonamiento tiene un agujero. Que
UNA consulta sin AIO tampoco convierta no refuta que el AIO sea el mecanismo en las NUEVE
que sí lo llevan. Toronto puede ser, simplemente, una consulta donde no posicionamos — otra
causa con el mismo síntoma. **El esquema v1 no puede distinguirlas**, porque registra si hay
AIO y dónde termina, y nada sobre qué más ocupa el resultado.

Y el 2026-08-27 el propietario comprobó a mano lo que ningún campo recogía: para
«a qué hora amanece en Madrid», **Google da la hora dentro del AI Overview**. Si el resultado
sirve el dato, el clic no es que compita en desventaja: es que sobra. Eso es un mecanismo
completamente distinto de «no somos visibles», y las dos hipótesis llevan a decisiones
opuestas.

## Los campos que añade el v2

Obligatorios en cada observación, además de los del v1 (`id`, `aiOverview`, `cited`,
`present`, `aioBottomPx`, `aioCited`, `topDomains`):

- **`answerInSerp`** (bool) — ¿el resultado contiene la respuesta a la consulta? Para las
  consultas de amanecer, ¿aparece la hora sin entrar en ningún sitio? Es **el campo que
  decide** entre «nos tapan» y «no hacemos falta».
- **`answerLocation`** (enum) — `"aio"`, `"widget"`, `"featured-snippet"`, `"none"`. Google
  lleva más de una década sirviendo horas de amanecer en un widget propio, anterior a los
  AIO. Confundir los dos mecanismos es exactamente el error que este campo evita.
- **`viewport`** (string, p. ej. `"390x844"` o `"1512x932"`) — las medidas de `aioBottomPx`
  se tomaron a 932 px de escritorio, y **el 70 % del tráfico es móvil**, donde 900 px llenan
  la pantalla. Sin este campo, los píxeles de dos lecturas no son comparables y la
  conclusión «el AIO no tapa el SERP» no está sostenida para el tráfico real.
- **`screenshotPath`** (string) — el propio baseline avisa de que no se guardó captura por
  consulta, así que **ninguna fila del v1 es re-auditable**. Una fila sin captura es una
  afirmación sin prueba.

## Transporte

Chrome del propietario con su perfil, vía la extensión. **No hay alternativa**: verificado
el 2026-08-27 que Playwright recibe la página de «tráfico inusual» de Google. No intentar
resolver el captcha.

Mínimo 18 s entre consultas, mismo conjunto fijo (`queries.json`), mismo orden.

## Lo que este instrumento NO puede contestar

Con una lectura por consulta no se distingue «posicionamos peor de lo que dice GSC» de la
varianza normal — lo dice el propio baseline y sigue siendo cierto. El v2 no lo arregla:
para eso hacen falta lecturas repetidas de la misma consulta en días distintos.

Y **la posición media de Search Console está condicionada a que haya habido impresión**:
describe dónde estábamos cuando nos vieron, no dónde estamos. Comparar esa cifra con una
observación puntual de SERP es comparar dos constructos distintos, y esa comparación no
debe usarse para afirmar una pérdida de posiciones.
