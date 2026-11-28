/**
 * Memory for what was seen: a thing that leaves sight is still believed where it was last seen,
 * less surely as time passes, until it is barely believed or the agent finds it gone.
 */

import type { Fact } from "../agent/fact.ts";
import type { Sensor } from "../kernel/loop.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { amount, find } from "../world/state.ts";

/** How long it takes to be half as sure of something not seen since. */
const HALF_LIFE = 60 * TICKS_PER_SECOND;
/** Less sure than this, and it is let go. */
const LET_GO = 0.1;
/** A recalled fact is renewed every tick, like the body's. */
const RECALL_TTL = 2;

interface Sighting {
  readonly t: number;
  readonly x: number;
  readonly y: number;
  /** What sight told about the thing itself, not how it stood to the agent. */
  readonly facts: readonly Fact[];
}

/** Wraps sight so that each agent remembers what it has seen. */
export function remembering(sight: Sensor): Sensor {
  const memories = new Map<string, Map<string, Sighting>>();
  return (input) => {
    const { t, world, self } = input;
    const seen = sight(input);
    const viewer = find(world, self);
    const mine = memories.get(self) ?? new Map<string, Sighting>();
    memories.set(self, mine);
    for (const fact of seen) {
      const thing = find(world, fact.subject);
      if (fact.subject === self || !thing) continue;
      const facts = seen.filter(({ subject }) => subject === fact.subject);
      mine.set(fact.subject, { t, ...thing.position, facts });
    }
    const recalled: Fact[] = [];
    for (const [id, sighting] of mine) {
      if (sighting.t === t) continue;
      const sure = 0.5 ** ((t - sighting.t) / HALF_LIFE);
      const found =
        viewer &&
        Math.hypot(viewer.position.x - sighting.x, viewer.position.y - sighting.y) <=
          amount(viewer, "reach");
      if (sure < LET_GO || found) mine.delete(id);
      else
        recalled.push(
          ...sighting.facts.map((fact) => ({
            ...fact,
            confidence: sure,
            tEvent: t,
            ttl: RECALL_TTL,
            source: "memory",
          })),
        );
    }
    return [...seen, ...recalled];
  };
}
