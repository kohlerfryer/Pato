/**
 * The rules that keep code, tests and docs in line: every spec item answers a requirement, every
 * scenario checks spec items, every test cites what it proves, and a phase can't be passed while
 * any of its items lacks a test.
 */

import type { Item, Kind, Problem } from "./parse.ts";
import type { TestFile } from "./scan.ts";

export interface Inputs {
  readonly items: readonly Item[];
  readonly tests: readonly TestFile[];
  /** The phase being built. Every item of an earlier phase must have a test. */
  readonly currentPhase: number;
}

/** What each kind of item may point back to. */
const POINTS_TO: Readonly<Record<Kind, Kind | null>> = { R: null, S: "R", E: "S" };

const at = (item: Item, rule: string, message: string): Problem => ({
  rule,
  message,
  file: item.file,
  line: item.line,
});

function duplicates(items: readonly Item[]): Problem[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return [];
    }
    return [at(item, "duplicate-id", `${item.id} is defined more than once`)];
  });
}

/** Why `item` may not point at `target`, if it may not. */
function badReference(item: Item, ref: string, target: Item | undefined): Problem | null {
  const wanted = POINTS_TO[item.kind];
  if (!target) return at(item, "unknown-ref", `${item.id} points at ${ref}, which doesn't exist`);
  if (target.kind !== wanted)
    return at(item, "wrong-ref", `${item.id} may only point at ${wanted ?? "nothing"} items`);
  if (item.phase === "deferred") return null;
  if (target.phase === "deferred")
    return at(item, "phase-order", `${item.id} is scheduled but ${ref} is deferred`);
  const [early, late] = item.kind === "S" ? [item, target] : [target, item];
  if (early.phase !== "deferred" && late.phase !== "deferred" && early.phase > late.phase)
    return at(item, "phase-order", `${early.id} must not come after ${late.id}`);
  return null;
}

function references(items: readonly Item[]): Problem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items.flatMap((item) =>
    item.refs.flatMap((ref) => badReference(item, ref, byId.get(ref)) ?? []),
  );
}

/** Spec items and scenarios that answer nothing, and requirements nothing answers. */
function orphans(items: readonly Item[]): Problem[] {
  const answered = new Set(
    items.filter((item) => item.phase !== "deferred").flatMap((item) => item.refs),
  );
  return items.flatMap((item) => {
    if (item.kind !== "R" && item.refs.length === 0)
      return [at(item, "orphan", `${item.id} points back to nothing`)];
    if (item.kind === "R" && item.phase !== "deferred" && !answered.has(item.id))
      return [at(item, "unmet-requirement", `no spec item answers ${item.id}`)];
    return [];
  });
}

function testProblems(items: readonly Item[], tests: readonly TestFile[]): Problem[] {
  const citable = new Set(items.filter((item) => item.kind !== "R").map((item) => item.id));
  return tests.flatMap(({ file, tags, disabled }) => [
    ...tags
      .filter((tag) => !citable.has(tag.id))
      .map((tag) => ({
        rule: "unknown-tag",
        message: `${tag.id} is not a spec item or scenario`,
        file,
        line: tag.line,
      })),
    ...disabled.map((line) => ({
      rule: "disabled-test",
      message: "tests may not be skipped, focused or left as todo",
      file,
      line,
    })),
    ...(tags.length === 0
      ? [{ rule: "untagged-test", message: "cite the spec item this tests", file, line: 1 }]
      : []),
  ]);
}

/** How many times each id is cited by a test. */
export function citations(tests: readonly TestFile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { id } of tests.flatMap((test) => test.tags))
    counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** The spec items and scenarios of `phase` that no test cites, in document order. */
export function untested(
  items: readonly Item[],
  tests: readonly TestFile[],
  phase: (phase: number) => boolean,
): Item[] {
  const cited = citations(tests);
  return items.filter(
    (item) =>
      item.kind !== "R" && item.phase !== "deferred" && phase(item.phase) && !cited.has(item.id),
  );
}

function phaseGaps({ items, tests, currentPhase }: Inputs): Problem[] {
  return untested(items, tests, (phase) => phase < currentPhase).map((item) =>
    at(item, "phase-gap", `${item.id} belongs to a passed phase but no test cites it`),
  );
}

export function check(inputs: Inputs): Problem[] {
  const { items, tests } = inputs;
  return [
    ...duplicates(items),
    ...references(items),
    ...orphans(items),
    ...testProblems(items, tests),
    ...phaseGaps(inputs),
  ];
}
