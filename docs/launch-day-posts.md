# Textos del día de lanzamiento — Product Hunt, martes 1 de septiembre de 2026

Escrito el 2026-08-27. **Estos tres son para el lanzamiento**, no para anunciar el
producto en general — para eso están `docs/linkedin-posts.md` y `docs/x-threads.md`, que
además se han quedado desfasados (dicen «50+ ciudades»; hoy son 235.606).

## La regla que manda sobre todo lo demás

**Product Hunt prohíbe pedir votos.** Lo detectan y penalizan el lanzamiento, a veces
retirándolo de portada. Y los votos de cuentas nuevas sin historial se filtran, así que
pedirlos ni siquiera funciona.

Se puede decir que has lanzado y **pedir opinión**. Los comentarios pesan en el ranking y
no infringen nada. La fórmula es «he lanzado esto, dime dónde falla», nunca «vótame».

Ninguno de los tres textos de abajo contiene una petición de voto. **No la añadas.**

---

## 1. Lunes 31, por la tarde — el aviso previo

Sin enlace, porque todavía no existe. Sirve para que quien quiera estar no se entere tres
días tarde. **Sobre todo por mensaje directo**, a diez o quince personas que de verdad
puedan opinar.

> Mañana por la mañana lanzo en Product Hunt el proyecto en el que llevo meses: una
> calculadora de vitamina D solar que ajusta el cálculo a tu tipo de piel. Te paso el
> enlace cuando esté por si te apetece echarle un ojo y decirme qué falla.

Si lo pones en LinkedIn, algo más corto:

> Mañana lanzo en Product Hunt. Llevo meses con esto y por fin sale.
>
> Es una calculadora de vitamina D solar, y el hallazgo que me llevó a construirla fue
> que el consejo de «15 minutos de sol» es correcto para dos de los seis tipos de piel y
> falso para los otros cuatro.
>
> Mañana lo cuento entero.

---

## 2. Martes 1, justo después de lanzar — LinkedIn

Publicar **inmediatamente después** de darle al botón, con el enlace de Product Hunt.

> El consejo que da todo el mundo es «toma 15 minutos de sol al día para la vitamina D».
>
> Fui a comprobar qué significa ese número exactamente, y resulta que es correcto para
> los tipos de piel III y IV, y falso para los otros cuatro.
>
> Mismo sitio, misma hora, misma piel expuesta:
>
> · Piel muy clara: 5 minutos
> · Piel media: 7,5 minutos
> · Piel oscura: 30 minutos
>
> Seis veces de diferencia. Un consejo que la ignora se equivoca con dos tercios de quien
> lo lee.
>
> Así que construí la calculadora que me hubiera gustado encontrar. Le dices tu ciudad
> —cualquiera de 235.000— y te calcula la ventana de hoy con geometría solar, ozono, UV en
> directo y nubes, ajustado a tu tipo de piel, tu edad y cuánta piel llevas descubierta.
>
> Y te dice cuándo la respuesta es **no**. Por encima de los 50°N hay meses en los que
> sintetizar es imposible a cualquier duración, porque el UV no llega al umbral. Casi
> ninguna herramienta te lo dice: te devuelve un número igualmente.
>
> Lo que más me ha costado y de lo que más contento estoy: el modelo es auditable. Holick
> y Dowdy para la síntesis, Madronich para el UV, van Heuklon para el ozono, y una página
> de metodología con las fórmulas y con los supuestos que harían que el número no valga
> para ti.
>
> También es un servidor MCP, así que si usas Claude puedes preguntárselo directamente a
> tu asistente.
>
> Gratis, sin cuenta, en seis idiomas, hecho en solitario.
>
> Acabo de lanzarlo en Product Hunt y me interesa mucho saber dónde falla — sobre todo si
> vives en una latitud en la que no he pensado lo suficiente.
>
> [enlace de Product Hunt]

**Imagen:** la comparación por tipo de piel. Es el argumento entero; si solo se ve una
captura, que sea esa.

---

## 3. Martes 1 — hilo de X

**1/**
> Everyone tells you to "get 15 minutes of sun" for vitamin D.
>
> That advice is right for two of the six skin types and wrong for the other four.
>
> Same city, same hour, same exposed skin:
> Type I — 5 minutes
> Type III — 7.5 minutes
> Type VI — 30 minutes
>
> Six times the difference 🧵

**2/**
> Your skin type decides how long you need, because melanin absorbs the UVB that makes
> the vitamin D.
>
> Generic advice is written for the middle of the range. If you're at either end, it's
> not slightly off — it's off by a factor of two or three.

**3/**
> It also matters *where* you are and *when*.
>
> Above ~50°N there are months where synthesis is physically impossible at any duration:
> UV never reaches the threshold. London, October to March.
>
> Most tools quietly return a number anyway. This one says no.

**4/**
> So I built the calculator I wanted to find.
>
> Pick a city — any of 235,000 — and it computes today's window from solar geometry,
> ozone, live UV and cloud cover, adjusted for your skin, your age and how much of it is
> exposed.

**5/**
> The model is auditable, which was the whole point.
>
> Holick & Dowdy for synthesis, Madronich for UV, van Heuklon for ozone. The methodology
> page shows the formulas — and the assumptions that would make the number wrong for you.

**6/**
> It's also an MCP server. If you use Claude, you can ask your assistant directly and it
> talks to the same engine, with your skin type.
>
> Free, no account, six languages, built solo.

**7/**
> Just launched it on Product Hunt. I'd love to hear where it's wrong — especially from
> anyone at a latitude I haven't thought hard enough about.
>
> [enlace]

---

## Verificado antes de escribir esto

- **5,0 / 7,5 / 30,0 minutos** — calculado con `minutesForVitD` el 2026-08-27 (Madrid,
  21 de junio, 25 % de piel, 35 años, objetivo 1000 UI). Si cambian `lib/vitd.ts` o
  `lib/uv-model.ts`, hay que volver a medirlo.
- **235.606 ciudades** — leído de la tabla `cities` el 2026-08-27. En los textos va
  redondeado a 235.000.
- **Ninguna afirmación sobre suplementos.** El borrador de abril decía «D3 + K2 +
  magnesio» y eso es una declaración de combinación que el Reglamento (UE) 432/2012 no
  autoriza y que `messages/__tests__/health-claims.test.ts` bloquea. No la reintroduzcas
  al adaptar.
