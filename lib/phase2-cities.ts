import assignment from "@/data/aio-tracking/phase2-assignment.json";

/**
 * Phase 2 ships to half the sunrise cities so its effect can be attributed
 * rather than guessed at. The assignment was fixed on 2026-08-10 and recorded
 * before shipping; see the JSON for the rule and the read-out.
 *
 * Reading it from the data file rather than restating it here means the
 * experiment has one definition, and the file that documents it is the file
 * that drives it.
 */
export const TREATED: readonly string[] = assignment.treated;
export const CONTROL: readonly string[] = assignment.control;

const TREATED_SET = new Set(TREATED);

/** Unknown cities are control: an accident must not enrol a page in the test. */
export function isTreated(citySlug: string): boolean {
  return TREATED_SET.has(citySlug);
}
