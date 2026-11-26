/** Reads the docs, the phase file and the tests from disk and runs the trace over them. */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { check } from "./check.ts";
import { type Item, type Problem, parseDoc } from "./parse.ts";
import { nextItems, nextLines, problemLines, summary } from "./report.ts";
import { type TestFile, scanTest } from "./scan.ts";

/** The three documents that hold numbered items, in the order work is listed. */
const DOCS = ["docs/prd.md", "docs/spec.md", "docs/evals.md"];
const PHASE_FILE = "docs/phase.json";
/** Only game code must cite the spec; the tools' own tests use ids as sample data. */
const TEST_ROOT = "src";

export interface TraceRun {
  readonly lines: readonly string[];
  readonly ok: boolean;
}

function readDocs(root: string): { items: Item[]; problems: Problem[] } {
  const items: Item[] = [];
  const problems: Problem[] = [];
  for (const file of DOCS) {
    const path = join(root, file);
    if (!existsSync(path)) {
      problems.push({ rule: "missing-doc", message: `${file} is missing`, file, line: 1 });
      continue;
    }
    const parsed = parseDoc(readFileSync(path, "utf8"), file);
    items.push(...parsed.items);
    problems.push(...parsed.problems);
  }
  return { items, problems };
}

function testPaths(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return testPaths(path);
      return entry.name.endsWith(".test.ts") ? [path] : [];
    })
    .sort();
}

function readTests(root: string): TestFile[] {
  return testPaths(join(root, TEST_ROOT)).map((path) =>
    scanTest(readFileSync(path, "utf8"), relative(root, path)),
  );
}

/** The phase being built, from `docs/phase.json`: `{ "current": 1 }`. */
function readPhase(root: string): number | null {
  const path = join(root, PHASE_FILE);
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const current = (parsed as { current?: unknown }).current;
  return typeof current === "number" && Number.isInteger(current) && current >= 0 ? current : null;
}

/** Checks the repository at `root`; with `next`, also lists that many items to build next. */
export function runTrace(root: string, next = 0): TraceRun {
  const { items, problems } = readDocs(root);
  const tests = readTests(root);
  const currentPhase = readPhase(root);
  if (currentPhase === null) {
    const bad = `${PHASE_FILE}:1: bad-phase: needs {"current": <whole number>}`;
    return { lines: [...problemLines(problems), bad], ok: false };
  }
  const all = [...problems, ...check({ items, tests, currentPhase })];
  const lines = [...problemLines(all), ...summary(items, tests, currentPhase)];
  if (next > 0)
    lines.push(
      "",
      "next:",
      ...nextLines(nextItems(items, tests, currentPhase, next), currentPhase),
    );
  return { lines, ok: all.length === 0 };
}
