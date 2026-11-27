/** A fact is one statement an agent's senses make about the world: who, what, how sure, and for how long. */

export type EntityId = string;

export interface Fact {
  /** Who or what it is about. */
  readonly subject: EntityId;
  readonly predicate: string;
  /** The second entity of a relation, as in near(subject, object). */
  readonly object?: EntityId;
  readonly value: boolean | number | string;
  /** From 0 to 1. */
  readonly confidence: number;
  /** The tick it became true. */
  readonly tEvent: number;
  /** How many ticks it stays believed. */
  readonly ttl: number;
  /** The sensor that emitted it. */
  readonly source: string;
}

/** Why `fact` can't be believed, or null if it can. */
export function factProblem({ confidence, ttl }: Fact): string | null {
  if (!(confidence >= 0 && confidence <= 1)) return "confidence must be from 0 to 1";
  if (!(Number.isInteger(ttl) && ttl >= 1)) return "ttl must be a whole number of ticks, 1 or more";
  return null;
}
