/** What evals measure. Everything here reads a parsed trace, or numbers taken from one. */

import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type ParsedTrace, select } from "./trace.ts";

const SECONDS_PER_MINUTE = 60;

/**
 * An agent's own level of something (its hunger, say) at each tick from 1 to `ticks`. A level is
 * logged when it changes, so the last one logged is carried forward. It is NaN until the first.
 */
export function levels(
  trace: ParsedTrace,
  {
    agent,
    predicate,
    ticks,
  }: { readonly agent: string; readonly predicate: string; readonly ticks: number },
): number[] {
  const told = new Map<number, number>();
  for (const { t, data } of select(trace, "fact", agent))
    if (data.subject === agent && data.predicate === predicate && typeof data.value === "number")
      told.set(t, data.value);
  const values: number[] = [];
  let last = Number.NaN;
  for (let t = 1; t <= ticks; t++) {
    last = told.get(t) ?? last;
    values.push(last);
  }
  return values;
}

/** The share of `values` that are below `limit`. */
export function shareBelow(values: readonly number[], limit: number): number {
  if (values.length === 0) return 0;
  return values.filter((value) => value < limit).length / values.length;
}

/** Whether the level ever went down from one tick to the next. */
export function everFell(values: readonly number[]): boolean {
  return values.some((value, i) => i > 0 && value < (values[i - 1] ?? Number.NaN));
}

/** How often something happened per simulated minute, given how many times over how many ticks. */
export function perMinute(count: number, ticks: number): number {
  return count / (ticks / TICKS_PER_SECOND / SECONDS_PER_MINUTE);
}

export function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? Number.NaN;
  return sorted.length % 2 === 1 ? upper : (upper + (sorted[middle - 1] ?? Number.NaN)) / 2;
}
