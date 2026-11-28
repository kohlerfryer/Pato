/**
 * Being inside things, under cover, and wet. Worked out for every thing that can move, at the end
 * of each tick, from where it stands and what it holds.
 */

import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { covers } from "./geometry.ts";
import { affords } from "./property.ts";
import { type Entity, type WorldState, amount, find } from "./state.ts";

/** How long under cover it takes to dry off. */
const DRYING_TICKS = 5 * TICKS_PER_SECOND;

/** The thing with an opening that `agent` stands within, on its level: the first by id. */
function insideOf(state: WorldState, agent: Entity): Entity | undefined {
  return state.entities.find(
    (object) =>
      affords(object, "canEnter") &&
      object.id !== agent.id &&
      object.level <= agent.level &&
      agent.level < object.level + Math.max(1, amount(object, "height")) &&
      covers(object, agent.position),
  );
}

function underCover(state: WorldState, agent: Entity, around: Entity | undefined): boolean {
  const held =
    typeof agent.props.holding === "string" ? find(state, agent.props.holding) : undefined;
  return [around, held].some((thing) => thing !== undefined && affords(thing, "keepsRainOff"));
}

/** Wet in the rain without cover; dry once under cover for long enough. */
function wetness(raining: boolean, covered: boolean, agent: Entity): Entity["props"] {
  if (raining && !covered) return { wet: true, dry_ticks: 0 };
  if (agent.props.wet !== true) return { wet: false, dry_ticks: 0 };
  const dried = covered ? amount(agent, "dry_ticks") + 1 : 0;
  return { wet: dried < DRYING_TICKS, dry_ticks: dried };
}

function sheltered(state: WorldState, agent: Entity): Entity {
  if (amount(agent, "speed") <= 0) return agent;
  const around = insideOf(state, agent);
  const covered = underCover(state, agent, around);
  const rest = Object.fromEntries(
    Object.entries(agent.props).filter(([name]) => name !== "inside"),
  );
  const props = {
    ...rest,
    ...(around ? { inside: around.id } : {}),
    under_cover: covered,
    ...wetness(state.raining, covered, agent),
  };
  return { ...agent, props };
}

/** `state` with each moving thing's `inside`, `under_cover` and `wet` brought up to date. */
export function shelter(state: WorldState): WorldState {
  return { ...state, entities: state.entities.map((entity) => sheltered(state, entity)) };
}
