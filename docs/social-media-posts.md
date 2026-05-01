# Posts para Redes Sociales — VitaminD Explorer

Posts genéricos adaptables a Twitter/X, Facebook groups, foros de salud, Hacker News, etc.

---

## Post corto (Twitter/X — 280 chars)

### Español
¿Puedes sintetizar vitamina D hoy con el sol? Depende de tu ciudad, tipo de piel y la hora. He creado una app gratuita que te lo calcula en tiempo real con datos UV reales. Sin registro.

getvitamind.app

### English
Can you synthesize vitamin D from sunlight today? Depends on your city, skin type, and time. I built a free app that calculates it in real-time using actual UV data. No sign-up.

getvitamind.app

---

## Post medio (Facebook groups, foros, comunidades — ~150 palabras)

### Español (para grupos de salud, nutrición, bienestar)

He creado una herramienta gratuita que calcula si hoy puedes sintetizar vitamina D con el sol en tu ciudad.

No es tan simple como "sal 15 minutos al sol". La síntesis depende del ángulo solar (que cambia con la latitud y la época del año), tu tipo de piel, tu edad y la nubosidad real. En Madrid, por ejemplo, es imposible durante parte del invierno. En Londres, durante casi 6 meses.

La app te dice:
- Si hay ventana de síntesis hoy y a qué hora
- Cuántos minutos necesitas según tu tipo de piel
- Previsión a 5 días
- Cuándo deberías suplementar (con guía de D3, K2 y magnesio)

Basada en investigación científica (Holick/Dowdy 2010) y datos UV reales de Open-Meteo.

Gratuita, sin registro, funciona en cualquier dispositivo: getvitamind.app

### English (for health, nutrition, wellness groups)

I built a free tool that calculates whether you can synthesize vitamin D from sunlight today in your city.

It's not as simple as "go outside for 15 minutes." Synthesis depends on solar elevation angle (which changes with latitude and season), your skin type, age, and actual cloud cover. In London, it's impossible for almost 6 months. Near the equator, it works year-round.

The app tells you:
- Whether there's a synthesis window today and at what time
- How many minutes you need based on your skin type
- 5-day forecast
- When you should supplement (with D3, K2, and magnesium guidance)

Based on peer-reviewed science (Holick/Dowdy 2010) and real UV data from Open-Meteo.

Free, no sign-up, works on any device: getvitamind.app

---

## Post largo (Hacker News / Indie Hackers / dev communities)

**Título HN:** Show HN: Vitamin D Explorer – solar vitamin D calculator using Holick/Dowdy models and real-time UV data

**Cuerpo:**

I built Vitamin D Explorer (https://getvitamind.app), a PWA that calculates when and how long you need sun exposure to synthesize vitamin D.

The science: vitamin D synthesis requires UVB at sufficient intensity (UV index ≥ 3), which only occurs when the sun exceeds ~45-50° elevation. This depends on latitude, date, and time of day. The app uses the Holick & Dowdy (2010) vitamin D estimation model, adjusted for Fitzpatrick skin type (I-VI), age (50% reduction from 20 to 80), exposed body area, and accounts for photodegradation ceiling (~19,200 IU full-body).

Features:
- Real-time synthesis windows using Open-Meteo UV data
- Personalized exposure time for target IU (400-4000)
- 5-day forecast with cloud cover integration
- Global heatmap (latitude × day-of-year)
- Interactive world map
- Push notifications (Web Push API)
- 90-day synthesis history
- Supplementation guidance (D3/K2/Mg)
- 6 languages (en, es, fr, de, ru, lt)

Stack: Next.js 16 (App Router), React 19, D3.js, Tailwind CSS v4, Supabase (auth + data), Web Push API, Vercel. PWA with offline support.

The origin story: I asked Claude to calculate whether I could produce vitamin D in London, it generated a solar geometry artifact, and I turned it into a full product.

---

## Para grupos específicos

### Grupos de expatriados (Facebook)
Título: "Moving to Northern Europe? Your vitamin D is about to take a hit"

If you've moved from a sunny country to the UK, Nordics, or northern Europe, you've probably heard about the "vitamin D problem." But do you know exactly when the sun can't help you anymore?

I built a free app that shows you the exact months and hours when vitamin D synthesis is possible in your city — and when you need to supplement. Personalized to your skin type.

getvitamind.app — free, no sign-up, works in 6 languages.

### Grupos de running / deporte outdoor
Título: "How to optimize your vitamin D while training outdoors"

If you train outside, you're already getting sun — but are you getting vitamin D? It depends on the time, the season, and how much skin is exposed.

I built a free tool that tells you the exact UV window for vitamin D synthesis in your city, personalized to your skin type. You can plan your outdoor sessions to maximize both training and vitamin D.

getvitamind.app

### Grupos de padres / maternidad
Título: "¿Tu hijo está recibiendo suficiente vitamina D?"

Los pediatras suelen recomendar suplementar vitamina D, especialmente en invierno. Pero ¿sabes exactamente cuándo el sol puede ayudar y cuándo no en tu ciudad?

He creado una app gratuita que te dice si hoy es posible sintetizar vitamina D con el sol en tu ubicación, a qué hora, y cuánto tiempo necesitas. Cuando no es posible, te recuerda que toca suplementar.

getvitamind.app — gratuita, sin registro.

---

## Consejos generales

1. **Adapta el tono** al grupo: técnico para devs, educativo para salud, práctico para grupos de vida
2. **Siempre incluye el enlace** como texto plano (getvitamind.app), no como hyperlink — se ve menos spam
3. **Acompaña con una captura** del móvil mostrando la ventana de síntesis activa (la verde)
4. **No publiques en más de 2-3 sitios el mismo día** — espacia para evitar parecer spam
5. **Facebook groups**: pide permiso al admin antes de publicar si las reglas lo exigen
6. **Twitter/X**: acompaña con un hilo corto (3-4 tweets) explicando la ciencia para más engagement
