# Product Hunt Launch — VitaminD Explorer

> Reescrito el 2026-08-27. El borrador anterior era del 25 de abril y describía un
> producto que ya no existe: le faltaban las páginas bajo demanda, el servidor MCP y las
> páginas de amanecer, y **contenía una afirmación médica que el propio repo prohíbe desde
> julio** (ver «Lo que NO se puede decir», abajo). No copies de una versión antigua.

## Tagline (60 caracteres)

`The sun calculator that knows your skin type`  (44)

Alternativas medidas, por si la primera no encaja con el tono del día:
- `Vitamin D from sunlight, calculated for your skin`  (49)
- `How long in the sun? Depends on your skin. We do the math`  (57)

**Por qué esta y no la anterior.** La de abril era «Know exactly when the sun can give you
vitamin D — for free». Decía *cuándo*, y ese dato lo regala Google. Lo que no regala nadie
es el **por tipo de piel**, que es donde está la diferencia real: 5 minutos para piel muy
clara contra 30 para piel oscura, en el mismo sitio y el mismo día.

## Descripción (260 caracteres)

```
Generic advice says "get 15 minutes of sun". That's right for two of the six skin
types and wrong for the rest. This calculates your window from your skin, location,
age and live UV — 5 min for type I, 30 for type VI. Free, no account, 6 languages.
```

(258 caracteres.)

## Primer comentario — publicar justo después de lanzar

Hey Product Hunt 👋

Every source tells you "get 10 to 15 minutes of sun for vitamin D". I checked what that
advice actually means, and it's correct for skin types III and IV — and wrong for the
other four.

Same city, same hour, same exposed skin, 1000 IU target:

- **Type I** (very fair, always burns): **5 minutes**
- **Type III** (medium): 7.5 minutes
- **Type VI** (dark, never burns): **30 minutes**

Six times the difference. Advice that ignores it is wrong for two thirds of the people
reading it.

**What it does**

Enter a city — any of 235,000+ — and it computes today's synthesis window from solar
geometry, ozone, live UV and cloud cover, adjusted for your skin type, age and how much
skin is exposed. It tells you how many minutes you need and when the window opens.

It also tells you when the answer is **no**. Above ~50°N there are months where synthesis
is physically impossible at any duration, because UV never reaches the threshold. Most
tools quietly return a number anyway.

**The bits I'm proudest of**

- **The model is auditable.** Holick & Dowdy (2010) for synthesis, Madronich for UV,
  van Heuklon for ozone. The methodology page shows the actual formulas — and the
  assumptions, including the ones that would make the number wrong for you.
- **It's an MCP server too.** If you use Claude or another MCP client, you can ask your
  assistant directly — it connects to the same engine, with your skin type. Ten tools,
  six of them public.
- **Daily notifications**, only on days when synthesis is actually possible. Sent at your
  local morning, not at a fixed UTC hour (that one took an embarrassing while to notice).
- **No account needed** for any of it. Sign-in exists only to sync across devices.
- Six languages: EN, ES, FR, DE, RU, LT.

**What it doesn't do**

It's not medical advice, and it doesn't diagnose deficiency — only a blood test does that.
When the sun can't do the job it says so and points at the supplement literature, without
telling you what to take.

Built solo, free, no ads, no tracking beyond page counts.

I'd love to hear where it's wrong. Especially if you're at a latitude I haven't thought
hard enough about.

## Lo que NO se puede decir — regla dura del repo

El borrador de abril decía *«recommends supplementation (D3 + K2 + magnesium)»*. **Eso no
puede publicarse.**

`messages/__tests__/health-claims.test.ts` bloquea desde julio de 2026 tres cosas, tras un
episodio en el que cinco afirmaciones llegaron a producción en cinco idiomas:

1. **Nada de sinergia ni de absorción entre nutrientes.** El Reglamento (UE) 432/2012 solo
   autoriza declaraciones por nutriente individual; ninguna por combinación. Decir que K2 o
   el magnesio «mejoran la absorción» de la vitamina D es una declaración no autorizada.
2. **Nada de K2 y salud cardiovascular.** La EFSA evaluó esa declaración (ID 125) y la
   **denegó** expresamente.
3. **La declaración ósea se atribuye a «vitamina K» genérica**, nombrando K2 solo como
   forma.

La redacción del sitio ya se corrigió a *«suele tomarse como D3, a menudo con magnesio
—que el organismo necesita para activarla— y vitamina K»*. Un post de Product Hunt es más
visible que cualquier página del sitio: aplica el mismo criterio.

## Temas

- Health & Fitness
- Weather
- Open Source *(si el repo es público el día del lanzamiento — comprobar antes)*

## Galería

Ya hay capturas en `screenshots/`; **revisa que correspondan al diseño actual** antes de
subirlas, porque el rediseño bold es posterior a algunas.

1. La respuesta del día en una ciudad, con la ventana y los minutos.
2. **La comparación por tipo de piel** — es el argumento del lanzamiento, tiene que verse.
3. Un mes en el que la respuesta es «imposible», que es lo que casi nadie muestra.
4. El mapa mundial o la franja del año.
5. El servidor MCP respondiendo dentro de un cliente — diferencia esto de las demás
   calculadoras y casi nadie lo tiene.

## Checklist

- [ ] Cuenta de Product Hunt creada y el perfil de maker relleno.
- [ ] Capturas revisadas contra el diseño actual (1270×760).
- [ ] **Comprobar que el enlace del footer y `/partners` no prometen nada que no sea
      cierto** — el copy de partners se reescribió el 26/8 y hay cifras dentro.
- [ ] Verificar que las cifras del primer comentario siguen siendo las que calcula el
      motor. Están medidas el 2026-08-27; si `lib/vitd.ts` o `lib/uv-model.ts` cambian,
      vuelven a medirse. Es la misma regla que el resto del copy del sitio.
- [ ] Martes o miércoles, 00:01 PST.
- [ ] Primer comentario listo para pegar en el mismo minuto.
- [ ] Avisar a la red **antes**, no después.

## Nota sobre el momento

El tráfico orgánico está en su valle estacional: cayó el 14 de agosto porque las consultas
de «amanecer en agosto» mueren con el mes, y las de septiembre aún no arrancan. Eso es una
ventaja para medir — **las visitas del lanzamiento no se confundirán con SEO**.
