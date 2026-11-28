/** Picking things up and putting them down. A held object goes wherever its holder goes. */

import { withinReach } from "./geometry.ts";
import { type Entity, type WorldState, find, withEntity } from "./state.ts";
import type { ActionRule } from "./step.ts";

const DONE = { status: "done" } as const;

const failed = (state: WorldState, reason: string): ReturnType<ActionRule> => ({
  state,
  outcome: { status: "failed", reason },
});

/** Brings what `holder` holds to where `holder` is. */
export function carry(state: WorldState, holder: Entity): WorldState {
  const id = holder.props.holding;
  const held = typeof id === "string" ? find(state, id) : undefined;
  if (!held) return state;
  return withEntity(state, { ...held, position: holder.position, level: holder.level });
}

/** Picks up a grabbable object within reach, if the hands are free. */
export const grab: ActionRule = (state, actorId, action) => {
  const actor = find(state, actorId);
  const object = action.kind === "grab" ? find(state, action.target) : undefined;
  if (!actor || object?.props.grabbable !== true) return failed(state, "not_grabbable");
  if (actor.props.holding !== undefined) return failed(state, "hands_full");
  if (!withinReach(actor, object)) return failed(state, "too_far");
  const holder = { ...actor, props: { ...actor.props, holding: object.id } };
  return { state: carry(withEntity(state, holder), holder), outcome: DONE };
};

/** Puts down what is held, where the holder stands. */
export const drop: ActionRule = (state, actorId) => {
  const actor = find(state, actorId);
  if (actor?.props.holding === undefined) return failed(state, "nothing_held");
  const props = Object.fromEntries(
    Object.entries(actor.props).filter(([name]) => name !== "holding"),
  );
  return { state: withEntity(carry(state, actor), { ...actor, props }), outcome: DONE };
};
