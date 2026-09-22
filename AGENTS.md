# AGENTS.md

The guidance for coding agents working in this repository lives in **[`CLAUDE.md`](./CLAUDE.md)**.

It is kept in one file on purpose: two copies drift, and a stale copy is worse than no
copy at all. Read `CLAUDE.md` before touching anything — it covers the architecture, the
quality gate, the deploy path, the environments, the Vercel usage limits, and a running
list of failures that have already cost this project traffic or a deploy.

The things most often got wrong, each written up in full there:

- **Deploys go through GitHub Actions and cost real build minutes.** Push to `master`
  ships production; push to `dev` ships the preview. Batch changes.
- **Copy changes to the month or city pages need a revision bump** in
  `lib/content-revision.ts`, or 2,880 pages ship announced as unchanged.
- **Any number stated in copy must be checked against the module that computes it.**
- **Search Console's query table is a sample (8.7% of impressions).** Never size a
  decision against the site total with it — that mistake already cost 99% of the traffic.
- **`next dev` returning 500 on every request** is usually a stray `node_modules` in the
  parent directory or a `.next` left mixed between Turbopack and webpack, not a code bug.
