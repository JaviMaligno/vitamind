## environments
- production-env: production [invariant]
- test-env: preview
- production: https://getvitamind.app · branch master
- preview: Vercel Preview deployment of the task SHA; stable dev alias is https://getvitamind-dev.vercel.app
Source: AGENTS.md environments and vercel inspect for both aliases · checked 2026-10-27

## vcs
- host: GitHub JaviMaligno/vitamind
- integration-branch: dev
- production-branch: master
- required-approvals: 0 (personal repository; no protection or rulesets)
Source: GitHub branch protection 404 and rulesets [] · checked 2026-10-27

## deploy
- via: pipeline
- served-sha-check: Vercel deployment metadata plus build-version from served service worker
Source: .github/workflows/ci.yml and scripts/build-sw.mjs · checked 2026-10-27

## tracker
- kind: none
Source: Direct incident request from Javier and forwarded Glama alert · checked 2026-10-27

## reviewers
- 1-codex: Independent correctness pass with regression tests · weight blocking · on diff
Source: Session has no automated review service; requesting-code-review skill · checked 2026-10-27
