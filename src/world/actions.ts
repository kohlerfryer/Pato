/** What each action does to the world, one tick at a time. */

import type { Action } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { CLOSE_ENOUGH, covers, radius, withinReach } from "./geometry.ts";
import { carry, drop, grab } from "./hands.ts";
import { jump, settle } from "./levels.ts";
import { type PropertyRule, affords, propertyRules } from "./property.ts";
import { type Entity, type WorldState, amount, find, withEntity } from "./state.ts";
import type { ActionRule } from "./step.ts";
import { type UseStep, applyUse } from "./uses.ts";

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
  const into = affords(entity, "canEnter");
  return { ...entity.position, level: entity.level, radius: into ? 0 : radius(entity) + reach };
}

/** Whether stepping to `moved` would walk into the side of something with no way in. */
function blocked(state: WorldState, actor: Entity, moved: Entity): boolean {
  return state.entities.some(
    (object) =>
      object.id !== actor.id &&
      object.id !== actor.props.holding &&
      !affords(object, "canEnter") &&
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

/** The first of `object`'s properties, by name, whose rule says what using it does, on `state`. */
function byProperty(
  rules: ReadonlyMap<string, PropertyRule>,
  state: WorldState,
  actor: Entity,
  object: Entity,
): ReturnType<ActionRule> | null {
  const named = Object.entries(object.props).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [name, strength] of named) {
    const use = rules.get(name)?.use;
    if (use) return use(state, actor, object, strength);
  }
  return null;
}

/** What using `object` does: its own steps, if its kind has any, then its properties. */
function used(
  rules: ReadonlyMap<string, PropertyRule>,
  steps: readonly UseStep[] | undefined,
  state: WorldState,
  [actor, object]: readonly [Entity, Entity],
): ReturnType<ActionRule> {
  const after = steps ? applyUse(state, actor, object, steps) : state;
  const [user, thing] = [find(after, actor.id) ?? actor, find(after, object.id) ?? object];
  const result = byProperty(rules, after, user, thing);
  if (result) return result;
  return steps ? { state: after, outcome: DONE } : failed(state, "no_effect");
}

/**
 * Uses an object: the one named, if it is within reach, or else the one held. What its object file
 * says using it does happens first, from `uses` by its kind. Then the first of its properties, by
 * name, that can be used has its say.
 */
export function createUse(
  rules: ReadonlyMap<string, PropertyRule>,
  uses: ReadonlyMap<string, readonly UseStep[]> = new Map(),
): ActionRule {
  return (state, actorId, action) => {
    const actor = find(state, actorId);
    if (!actor || action.kind !== "use") return failed(state, "nothing_to_use");
    const object = aimedAt(state, actor, action.target);
    if (!object) return failed(state, "nothing_to_use");
    if (action.target !== undefined && !withinReach(actor, object)) return failed(state, "too_far");
    return used(rules, uses.get(String(object.props.kind)), state, [actor, object]);
  };
}

/** The rule for every action the world knows how to carry out. */
export function actionRules(
  uses: ReadonlyMap<string, readonly UseStep[]> = new Map(),
): Record<Action["kind"], ActionRule> {
  return { move_to: moveTo, use: createUse(propertyRules(), uses), grab, drop, jump };
}
