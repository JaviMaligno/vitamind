# Reddit Posts Adaptados por Subreddit

Cada post adaptado al tono, reglas y audiencia del sub. Listos para copiar y pegar.

---

## r/SideProject (~200k miembros)

**Audiencia:** devs e indie hackers que muestran lo que han construido. Valoran el stack técnico y el "build in public".

**Título:** I built a PWA that calculates your daily vitamin D synthesis window based on real UV data, skin type, and age

**Cuerpo:**

Hey! Sharing my side project: a solar vitamin D calculator.

**The problem:** People don't know when (or if) the sun at their location is strong enough to produce vitamin D. The answer depends on latitude, date, time, skin type, and age — but most advice is just "go outside."

**What it does:**
- Calculates the exact time window for vitamin D synthesis at any location worldwide
- Tells you how many minutes you need based on Fitzpatrick skin type, age, and body area exposed
- 5-day forecast with real weather data
- Switches to supplementation guidance when synthesis isn't possible
- Push notifications when your UV window opens
- 90-day synthesis history tracking

**Stack:**
- Next.js App Router + TypeScript
- D3.js for visualizations (daily curve, world map with UV overlay, global heatmap)
- Open-Meteo API for real-time UV data
- Supabase for push subscriptions + auth
- Web Push API for notifications
- PWA (installable, cache-first SW)
- Deployed on Vercel

**The science:** Based on the Holick & Dowdy (2010) estimation model. Accounts for Minimal Erythemal Dose by skin type, age degradation factor, photodegradation ceiling, and cloud cover.

Link: [getvitamind.app](https://getvitamind.app)

Free, no account needed. Would love feedback from this community — especially on UX and what features you'd add.

---

## r/InternetIsBeautiful (~17M miembros)

**Audiencia:** general. Buscan herramientas web útiles, bonitas, y gratuitas. NO les gusta la autopromoción obvia. El post debe sonar como "mira esta herramienta que encontré", no "mira lo que hice". No se permite sign-up obligatorio (tu app cumple esto).

**Título:** A free web tool that tells you whether you can produce vitamin D today based on your exact location, skin type, and the sun's angle

**Cuerpo:**

This tool calculates whether the sun at your location is high enough for your skin to synthesize vitamin D right now — and if so, exactly how many minutes you need.

It uses real UV data and solar geometry to determine the daily synthesis window. Turns out it's not about whether it's "sunny" — it's about the solar elevation angle. Below ~45-50°, UVB can't penetrate the atmosphere enough, no matter how warm it feels.

Some examples of when synthesis is impossible:
- London: October to March
- Stockholm: September to April
- Madrid: November to February

When synthesis isn't possible, it gives supplementation guidance instead.

Works for any city worldwide, personalized by skin type (Fitzpatrick I-VI) and age. No account needed, no ads.

[getvitamind.app](https://getvitamind.app)

---

## r/AlphaAndBetaUsers (~30k miembros)

**Audiencia:** founders buscando testers y testers buscando productos nuevos. Formato esperado: descripción clara del producto + qué tipo de feedback buscas.

**Título:** [Web App] Vitamin D synthesis calculator — looking for feedback on UX and accuracy from different latitudes

**Cuerpo:**

**URL:** https://getvitamind.app

**Purpose:** Calculate when and how long you need to be in the sun to produce vitamin D, based on your location, skin type, age, and body exposure.

**Stage:** Live and functional. Looking for beta feedback.

**What it does:**
- Shows today's vitamin D synthesis window (start/end time) for your city
- Calculates minutes needed for 400-4000 IU targets
- Personalized by Fitzpatrick skin type (I-VI), age, and exposed body area
- 5-day forecast with weather integration
- Supplementation guidance when sun isn't enough
- Push notifications when your daily UV window opens
- Global heatmap showing where synthesis is possible by latitude and month

**Platform:** PWA — works on any device via browser. Installable on home screen.

**What I'm looking for:**
1. Does the UX make sense? Is anything confusing on first use?
2. Are the time estimates reasonable for your location? (especially interested in feedback from people at extreme latitudes — Nordics, Southern hemisphere, tropics)
3. Is the supplementation info clear and useful?
4. What features would make you come back daily?

No account needed, completely free. Available in English, Spanish, French, German, Russian, and Lithuanian.

Thanks in advance!

---

## r/IMadeThis (~50k miembros)

**Audiencia:** makers/creadores mostrando cualquier cosa que hayan construido. Tono orgulloso pero humilde. Posts cortos, directos.

**Título:** I made a vitamin D calculator that tells you if the sun at your location can actually help you today

**Cuerpo:**

I built this because I kept seeing the same confusion online: people thinking they're getting vitamin D just by being outside, when in reality it depends on the UV index, solar angle, skin type, and time of year.

At my latitude (40°N, Madrid), synthesis is impossible from November to February. In London, it's October to March. Most people have no idea.

So I made a free web app that calculates your daily vitamin D window:

[getvitamind.app](https://getvitamind.app)

You pick your city, skin type, and age — and it tells you exactly when and how long to be in the sun. When the sun can't help, it recommends supplements.

Built with Next.js, D3.js for the visualizations, and it's a PWA so you can install it on your phone. No sign-up, no ads.

---

## Consejos generales

1. **r/SideProject** — Publica primero aquí, es el más permisivo con autopromoción
2. **r/InternetIsBeautiful** — El más arriesgado (mods estrictos). Tono neutro, nada de "I built". Si lo borran, no repostees
3. **r/AlphaAndBetaUsers** — Pide feedback específico, no genérico. Los testers quieren saber qué evaluar
4. **r/IMadeThis** — Corto y al grano. La historia personal (el "why") importa más que las features
5. **Orden recomendado:** SideProject → IMadeThis → AlphaAndBetaUsers → InternetIsBeautiful (de más a menos permisivo)
6. **Espacia 2-3 días** entre posts para no parecer spam en tu historial
7. **Responde todo** — engagement en los comentarios es clave para visibilidad
