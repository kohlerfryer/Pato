/**
 * Standing on things. An object stands a whole number of levels tall, so its top is its level
 * plus its height. An agent can jump one level up onto a flat top, and falls when it walks off one.
 */

import { CLOSE_ENOUGH, apart, withinReach } from "./geometry.ts";
import { carry } from "./hands.ts";
import { type Entity, type WorldState, amount, find, withEntity } from "./state.ts";
import type { ActionRule } from "./step.ts";

const topOf = (entity: Entity): number => entity.level + amount(entity, "height");

/** Whether `object` has a flat top that covers where `agent` stands. */
const beneath = (object: Entity, agent: Entity): boolean =>
  object.props.flat_top === true &&
  object.id !== agent.id &&
  object.id !== agent.props.holding &&
  Math.abs(object.position.x - agent.position.x) <= amount(object, "width") / 2 + CLOSE_ENOUGH &&
  Math.abs(object.position.y - agent.position.y) <= amount(object, "depth") / 2 + CLOSE_ENOUGH;

/** Moves `agent` and what it holds to a new place and level. */
function place(
  state: WorldState,
  agent: Entity,
  at: Pick<Entity, "position" | "level">,
): WorldState {
  const moved = { ...agent, ...at };
  return carry(withEntity(state, moved), moved);
}

/** Lands on the nearest flat top within reach whose top is one level up, first by id on a tie. */
export const jump: ActionRule = (state, actorId) => {
  const actor = find(state, actorId);
  const landing = state.entities
    .filter((object) => actor && object.props.flat_top === true && object.id !== actor.id)
    .filter((object) => actor && topOf(object) === actor.level + 1 && withinReach(actor, object))
    .sort((a, b) => (actor ? apart(actor, a) - apart(actor, b) : 0) || (a.id < b.id ? -1 : 1))[0];
  if (!actor || !landing)
    return { state, outcome: { status: "failed", reason: "nothing_to_land_on" } };
  return {
    state: place(state, actor, { position: landing.position, level: actor.level + 1 }),
    outcome: { status: "done" },
  };
};

/** Drops the agent onto the highest top beneath it that is no higher than it stands, or the ground. */
export function settle(state: WorldState, agentId: string): WorldState {
  const agent = find(state, agentId);
  if (!agent) return state;
  const tops = state.entities
    .filter((object) => beneath(object, agent))
    .map(topOf)
    .filter((top) => top <= agent.level);
  const level = Math.max(0, ...tops);
  return level === agent.level ? state : place(state, agent, { position: agent.position, level });
}
