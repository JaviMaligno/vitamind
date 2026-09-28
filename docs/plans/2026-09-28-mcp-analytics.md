# MCP analytics implementation plan

**Goal:** Persist MCP tool usage without routine per-call runtime logs or sensitive payloads.
**Architecture:** A server-only measurement wrapper records one event per executed tool handler. Supabase writes run through Next.js after(), with a bounded timeout, and never change the tool response. A dedicated RLS-protected table separates this stream from browser visitor analytics.
**Tech Stack:** TypeScript, Next.js after(), Supabase service role, PostgreSQL, Vitest.
**Risks:** Apply the migration before deploying. No historical backfill exists. Count handler calls, not transport requests or unique people; HTTP auth/validation failures before handlers are outside this stream. Storage failures remain diagnostic logs, not successful measurements.

### Task 1: Persistence and measurement
- Create lib/mcp-analytics.ts and lib/__tests__/mcp-analytics.test.ts.
- First test preserved responses/exceptions, outcome classification, one record per call, deferred writes, safe field allowlist, environment separation and storage failure isolation.
- Run npm test -- lib/__tests__/mcp-analytics.test.ts; expect failure before implementation, pass after.
- Implement recordMcpCall and measureMcpCall; only tool name, timestamp, duration, outcome and environment persist. Bound writes to 3 seconds.

### Task 2: Registration integration and schema
- Modify lib/mcp-server.ts: replace timed logging with measureMcpCall, wrapping personal auth checks too.
- Create supabase/migrations/20260928_mcp_call_events.sql with RLS, no public policies and an environment/time index.
- Add registration integration tests for public and OAuth tools and verify existing MCP protocol tests.

### Task 3: Queries, evidence and verification
- Update docs/analytics.md and CLAUDE.md with semantics, production-only 28-day/daily/latency SQL and migration status.
- Preserve the measured browser analytics aggregate in docs/analytics-results/2026-09-28-28-days.json.
- Finish the pending partners/MCP inventory/outreach corrections; run health-claims and locale tests.
- Run npm run lint, npm run typecheck and npm test. Review the diff for secrets, privacy and response regressions. Do not deploy or claim live collection before applying the migration and deploying code.

## Implementation status

Completed locally on 2026-09-28. Full suite: 1934 passed, 0 failed, 1 skipped (four workers). Lint passed. The initial broad run exposed a pre-existing CRLF parsing bug in app/__tests__/ci-workflow.test.ts; its line splitter now accepts both line endings. The solar hub test timed out under unrestricted concurrency and passed isolated and with four workers.

Migration applied to the linked Supabase project on 2026-09-28; RLS and role permissions verified remotely. Production deployment of 139dba2 completed through GitHub Actions run 36424670224 with the full Vercel quality gate and build passing. Verified at 13:01 UTC: the public domain serves the expected version, 15 tools are exposed, public success and personal auth refusal are persisted, anon reads return 401, and partners serves corrected copy in all six locales. Evidence: ../analytics-results/2026-09-28-mcp-deployment.json. No earlier MCP events are backfilled.
