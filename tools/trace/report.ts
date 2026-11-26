/** Turns the trace into something to read: problems, progress per phase, and what to build next. */

import { citations, untested } from "./check.ts";
import type { Item, Problem } from "./parse.ts";
import type { TestFile } from "./scan.ts";

export function problemLines(problems: readonly Problem[]): string[] {
  return problems.map(
    ({ file, line, rule, message }) => `${file}:${String(line)}: ${rule}: ${message}`,
  );
}

interface Progress {
  readonly phase: number;
  readonly total: number;
  readonly covered: number;
}

/** For each phase, how many of its spec items and scenarios a test cites. */
export function progress(items: readonly Item[], tests: readonly TestFile[]): Progress[] {
  const cited = citations(tests);
  const phases = new Map<number, { total: number; covered: number }>();
  for (const item of items) {
    if (item.kind === "R" || item.phase === "deferred") continue;
    const tally = phases.get(item.phase) ?? { total: 0, covered: 0 };
    tally.total += 1;
    if (cited.has(item.id)) tally.covered += 1;
    phases.set(item.phase, tally);
  }
  return [...phases.entries()]
    .sort(([a], [b]) => a - b)
    .map(([phase, tally]) => ({ phase, ...tally }));
}

function progressLine({ phase, covered, total }: Progress, currentPhase: number): string {
  const mark = phase === currentPhase ? "  <- current" : "";
  return `phase ${String(phase)}: ${String(covered)}/${String(total)} tested${mark}`;
}

/** The first `count` untested items of the current phase, spec items before scenarios. */
export function nextItems(
  items: readonly Item[],
  tests: readonly TestFile[],
  currentPhase: number,
  count: number,
): Item[] {
  const open = untested(items, tests, (phase) => phase === currentPhase);
  const specFirst = [...open.filter((i) => i.kind === "S"), ...open.filter((i) => i.kind === "E")];
  return specFirst.slice(0, count);
}

export function summary(
  items: readonly Item[],
  tests: readonly TestFile[],
  currentPhase: number,
): string[] {
  return progress(items, tests).map((row) => progressLine(row, currentPhase));
}

export function nextLines(open: readonly Item[], currentPhase: number): string[] {
  if (open.length === 0)
    return [`phase ${String(currentPhase)} has a test for every item; it is ready for its gate`];
  return open.map(({ id, text, file, line }) => `${id}  ${text}  (${file}:${String(line)})`);
}
