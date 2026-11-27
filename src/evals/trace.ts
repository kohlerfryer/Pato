/** Helpers for evals. Each takes a parsed trace and nothing else, so an eval can't peek at internal state. */

import type { TraceEvent } from "../kernel/trace.ts";

export interface ParsedTrace {
  readonly header: { readonly schema: number; readonly seed: number; readonly scenario: string };
  readonly events: readonly TraceEvent[];
}

/** Reads a trace written as JSON Lines. */
export function parseTrace(text: string): ParsedTrace {
  const [header, ...events] = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as unknown);
  if (header === undefined) throw new Error("a trace starts with a header line");
  return { header: header as ParsedTrace["header"], events: events as TraceEvent[] };
}

/** The events of one type, in order; for one agent when `agent` is given. */
export function select(
  trace: ParsedTrace,
  type: TraceEvent["type"],
  agent?: string,
): readonly TraceEvent[] {
  return trace.events.filter(
    (event) => event.type === type && (agent === undefined || event.agent === agent),
  );
}
