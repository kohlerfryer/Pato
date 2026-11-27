/** A skill is something an agent knows how to do: a short run of actions, with when it applies and what it achieves. */

import type { Action } from "./action.ts";
import type { Belief } from "./belief.ts";
import type { Condition } from "./condition.ts";
import type { EntityId } from "./fact.ts";

/** Which entities can fill a parameter: any that has every listed property. */
interface PropertyQuery {
  readonly has: readonly string[];
}

export interface Skill {
  readonly id: string;
  /** What the skill acts on, by property and never by entity id. */
  readonly params: Readonly<Record<string, PropertyQuery>>;
  readonly pre: readonly Condition[];
  readonly effects: readonly Condition[];
  /** Actions whose targets name parameters, as `$food`. */
  readonly body: readonly Action[];
  readonly origin: "instinct" | "learned";
}

/** Whether the agent believes in `entity` and believes it has every property `query` asks for. */
export function matches(belief: Belief, entity: EntityId, query: PropertyQuery): boolean {
  const known = belief.facts().some((fact) => fact.subject === entity);
  return (
    known &&
    query.has.every(
      (property) => belief.get({ subject: entity, predicate: property })?.value === true,
    )
  );
}
