# VitaminD Explorer

Solar vitamin D calculator PWA — know when and where you can synthesize
vitamin D from sunlight, based on solar elevation, real-time UV index, skin
type, body exposure and age.

**Live:** https://getvitamind.app

## Stack

Next.js (App Router) · next-intl (es/en/fr/de/ru/lt) · Tailwind CSS v4 · D3 ·
Supabase (auth, profiles, city search, push subscriptions) · Web Push ·
Vercel (hosting + daily cron).

## Development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # localhost:3000
```

Quality gate (all must pass, enforced by CI on every push/PR):

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — architecture, deployment runbook, operational
  gotchas and incident history.
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md) —
  production-readiness assessment and the practices that keep it that way.

## License

MIT
