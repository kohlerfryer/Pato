/** What each action does to the world, one tick at a time. */

import type { Action } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { CLOSE_ENOUGH, covers, radius, withinReach } from "./geometry.ts";
import { carry, drop, grab } from "./hands.ts";
import { jump, settle } from "./levels.ts";
import { type PropertyRule, propertyRules } from "./property.ts";
import { type Entity, type WorldState, amount, find, withEntity } from "./state.ts";
import type { ActionRule } from "./step.ts";

const UNREACHABLE = { status: "failed", reason: "unreachable" } as const;
const DONE = { status: "done" } as const;
const BLOCKED = { status: "failed", reason: "blocked" } as const;

/** Where a move is headed, and how far from its centre counts as there. */
interface Aim {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly radius: number;
}

type Target = Extract<Action, { kind: "move_to" }>["target"];

/** Where to head for. A thing with an opening is walked into, so its centre is the aim. */
function aimAt(state: WorldState, actor: Entity, target: Target): Aim | undefined {
  const reach = amount(actor, "reach");
  if (typeof target !== "string") return { ...target, level: actor.level, radius: reach };
  const entity = find(state, target);
  if (!entity) return undefined;
  const into = entity.props.has_opening === true;
  return { ...entity.position, level: entity.level, radius: into ? 0 : radius(entity) + reach };
}

/** Whether stepping to `moved` would walk into the side of something with no way in. */
function blocked(state: WorldState, actor: Entity, moved: Entity): boolean {
  return state.entities.some(
    (object) =>
      object.id !== actor.id &&
      object.id !== actor.props.holding &&
      object.props.has_opening !== true &&
      object.level <= actor.level &&
      actor.level < object.level + amount(object, "height") &&
      covers(object, moved.position) &&
      !covers(object, actor.position),
  );
}

/** Walks the actor toward its target at its speed, and is done once the target is within reach. */
export const moveTo: ActionRule = (state, actorId, action) => {
  const actor = find(state, actorId);
  const aim = actor && action.kind === "move_to" ? aimAt(state, actor, action.target) : undefined;
  if (!actor || aim?.level !== actor.level) return { state, outcome: UNREACHABLE };
  const dx = aim.x - actor.position.x;
  const dy = aim.y - actor.position.y;
  const gap = Math.hypot(dx, dy) - aim.radius;
  if (gap <= CLOSE_ENOUGH) return { state, outcome: DONE };
  const stride = Math.min(gap, amount(actor, "speed") / TICKS_PER_SECOND);
  const scale = stride / Math.hypot(dx, dy);
  const position = { x: actor.position.x + dx * scale, y: actor.position.y + dy * scale };
  const moved = { ...actor, position };
  if (blocked(state, actor, moved)) return { state, outcome: BLOCKED };
  const next = settle(carry(withEntity(state, moved), moved), actorId);
  return gap - stride <= CLOSE_ENOUGH ? { state: next, outcome: DONE } : { state: next };
};

const failed = (state: WorldState, reason: string): ReturnType<ActionRule> => ({
  state,
  outcome: { status: "failed", reason },
});

/** The object an actor's `use` is aimed at: the one named, or else the one held. */
function aimedAt(state: WorldState, actor: Entity, target: string | undefined): Entity | undefined {
  const id = target ?? actor.props.holding;
  return typeof id === "string" ? find(state, id) : undefined;
}

/**
 * Uses an object: the one named, if it is within reach, or else the one held. What happens is up
 * to the object's properties, and the first one, by name, that can be used decides.
 */
export function createUse(rules: ReadonlyMap<string, PropertyRule>): ActionRule {
  return (state, actorId, action) => {
    const actor = find(state, actorId);
    if (!actor || action.kind !== "use") return failed(state, "nothing_to_use");
    const object = aimedAt(state, actor, action.target);
    if (!object) return failed(state, "nothing_to_use");
    if (action.target !== undefined && !withinReach(actor, object)) return failed(state, "too_far");
    for (const [name, strength] of Object.entries(object.props).sort(([a], [b]) =>
      a < b ? -1 : 1,
    )) {
      const use = rules.get(name)?.use;
      if (use) return use(state, actor, object, strength);
    }
    return failed(state, "no_effect");
  };
}

/** The rule for every action the world knows how to carry out. */
export function actionRules(): Record<Action["kind"], ActionRule> {
  return { move_to: moveTo, use: createUse(propertyRules()), grab, drop, jump };
}
