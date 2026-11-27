/** The only thing that changes the world: one tick's worth of the actions agents have under way. */

import type { Action, Outcome } from "../agent/action.ts";
import type { EntityId } from "../agent/fact.ts";
import { grow } from "./needs.ts";
import { type WorldState, frozen } from "./state.ts";

/**
 * Carries one actor's action forward by a tick. Returns the next state, and how the action ended
 * if it has; no outcome means it is still going.
 */
export type ActionRule = (
  state: WorldState,
  actor: EntityId,
  action: Action,
) => { readonly state: WorldState; readonly outcome?: Outcome };

type ActionRules = Partial<Record<Action["kind"], ActionRule>>;

interface Stepped {
  readonly state: WorldState;
  /** How each action that ended this tick ended, by actor. */
  readonly outcomes: ReadonlyMap<EntityId, Outcome>;
}

/**
 * Applies each actor's action, in actor id order so a run never depends on who asked first, then
 * lets every need grow by a tick.
 */
export function step(
  state: WorldState,
  requests: ReadonlyMap<EntityId, Action>,
  rules: ActionRules,
): Stepped {
  const outcomes = new Map<EntityId, Outcome>();
  let next = state;
  for (const actor of [...requests.keys()].sort()) {
    const action = requests.get(actor);
    if (!action) continue;
    const rule = rules[action.kind];
    if (!rule) {
      outcomes.set(actor, { status: "failed", reason: "no_rule" });
      continue;
    }
    const result = rule(next, actor, action);
    next = result.state;
    if (result.outcome) outcomes.set(actor, result.outcome);
  }
  return { state: frozen({ ...next, entities: next.entities.map(grow) }), outcomes };
}
