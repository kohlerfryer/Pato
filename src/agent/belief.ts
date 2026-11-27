/** What one agent currently believes: the newest fact it has for each thing a fact can be about. */

import { type Fact, factProblem } from "./fact.ts";

/** What a fact is about. Belief holds one fact for each. */
type FactKey = Pick<Fact, "subject" | "predicate" | "object">;

export interface Belief {
  /** Takes `fact` unless it is malformed or loses to what is already believed; says whether it was taken. */
  add(fact: Fact): boolean;
  get(key: FactKey): Fact | undefined;
  /** Everything believed, in the order each was first learned. */
  facts(): readonly Fact[];
  /** Forgets every fact whose ttl has run out by tick `t`. */
  expire(t: number): void;
}

const SEPARATOR = "\u0000";

const keyOf = ({ subject, predicate, object }: FactKey): string =>
  [subject, predicate, object ?? ""].join(SEPARATOR);

/** A later fact beats an earlier one; at the same tick, the more confident one does. */
function beats(incoming: Fact, held: Fact): boolean {
  if (incoming.tEvent !== held.tEvent) return incoming.tEvent > held.tEvent;
  return incoming.confidence > held.confidence;
}

export function createBelief(): Belief {
  const held = new Map<string, Fact>();
  return {
    add(fact) {
      if (factProblem(fact) !== null) return false;
      const key = keyOf(fact);
      const current = held.get(key);
      if (current && !beats(fact, current)) return false;
      held.set(key, fact);
      return true;
    },
    get: (key) => held.get(keyOf(key)),
    facts: () => [...held.values()],
    expire(t) {
      for (const [key, fact] of held) if (t > fact.tEvent + fact.ttl) held.delete(key);
    },
  };
}
