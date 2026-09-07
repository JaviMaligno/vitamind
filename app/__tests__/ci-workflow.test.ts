import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `.github/workflows/ci.yml` is not typechecked, not linted and not exercised by
 * anything else, and both properties pinned here are the kind that a tidy-up
 * silently reverses — each with a failure that shows up somewhere else entirely.
 *
 * No YAML parser is a dependency of this project, and adding one to read a file
 * of three jobs is not worth it, so the blocks are sliced by indentation.
 */
function jobBlock(yaml: string, job: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l === `  ${job}:`);
  expect(start, `job "${job}" not found in ci.yml`).toBeGreaterThan(-1);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {2}\S/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

const WORKFLOW = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

/**
 * A deploy is a ~22-minute build that prerenders every route, on a plan that has
 * been over its limits. A commit that only touches documentation changes nothing
 * the site serves, so it must not buy one.
 */
describe("docs-only pushes do not deploy", () => {
  it.each(["'**.md'", "'docs/**'"])("paths-ignore still covers %s", (pattern) => {
    expect(WORKFLOW).toContain(pattern);
  });

  it("keeps paths-ignore under push, never under pull_request", () => {
    // A docs-only PR is exactly where a stale link or a wrong command hides, and
    // those checks run on GitHub's runners, so they cost nothing.
    const pushBlock = WORKFLOW.slice(
      WORKFLOW.indexOf("  push:"),
      WORKFLOW.indexOf("  pull_request:"),
    );
    expect(pushBlock).toContain("paths-ignore:");
    expect(WORKFLOW.slice(WORKFLOW.indexOf("  pull_request:"))).not.toContain("paths-ignore:");
  });
});

/**
 * THE ALIAS RACE, AND WHY QUEUEING IS NOT CANCELLING.
 *
 * Two pushes to master close together ran two builds at once, and the production
 * alias went to whichever FINISHED last — not necessarily the newer commit.
 *
 * Cancelling the older run does NOT fix it: `vercel deploy --prod` creates the
 * deployment on Vercel and waits, so killing the job here leaves the remote build
 * running, and it still claims the alias. Only queueing — the second deployment
 * is not created until the first is done — makes the last alias assignment the
 * newest commit.
 */
describe("deploy jobs queue instead of cancelling", () => {
  it.each(["deploy-prod", "deploy-dev"])("%s queues", (job) => {
    const block = jobBlock(WORKFLOW, job);
    expect(block).toContain("concurrency:");
    expect(block).toContain(`group: ${job}`);
    expect(block).toContain("cancel-in-progress: false");
  });

  it("gives prod and dev separate groups, so dev never waits on master", () => {
    expect(jobBlock(WORKFLOW, "deploy-prod")).toContain("group: deploy-prod");
    expect(jobBlock(WORKFLOW, "deploy-dev")).toContain("group: deploy-dev");
  });

  it("cancels the PR check job instead, which touches nothing outside GitHub", () => {
    expect(jobBlock(WORKFLOW, "ci")).toContain("cancel-in-progress: true");
  });
});
