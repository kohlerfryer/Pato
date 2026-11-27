/** What each action does to the world, one tick at a time. */

import type { Action } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type Entity, type WorldState, amount, find, withEntity } from "./state.ts";
import type { ActionRule } from "./step.ts";

/** Closer than this counts as arrived, so rounding never costs a tick. */
const CLOSE_ENOUGH = 1e-9;
const UNREACHABLE = { status: "failed", reason: "unreachable" } as const;
const DONE = { status: "done" } as const;

/** Where a move is headed, and how far from its centre counts as there. */
interface Aim {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly radius: number;
}

type Target = Extract<Action, { kind: "move_to" }>["target"];

function aimAt(state: WorldState, actor: Entity, target: Target): Aim | undefined {
  if (typeof target !== "string") return { ...target, level: actor.level, radius: 0 };
  const entity = find(state, target);
  if (!entity) return undefined;
  const radius = Math.max(amount(entity, "width"), amount(entity, "depth")) / 2;
  return { ...entity.position, level: entity.level, radius };
}

/** Walks the actor toward its target at its speed, and is done once the target is within reach. */
export const moveTo: ActionRule = (state, actorId, action) => {
  const actor = find(state, actorId);
  const aim = actor && action.kind === "move_to" ? aimAt(state, actor, action.target) : undefined;
  if (!actor || aim?.level !== actor.level) return { state, outcome: UNREACHABLE };
  const dx = aim.x - actor.position.x;
  const dy = aim.y - actor.position.y;
  const gap = Math.hypot(dx, dy) - amount(actor, "reach") - aim.radius;
  if (gap <= CLOSE_ENOUGH) return { state, outcome: DONE };
  const stride = Math.min(gap, amount(actor, "speed") / TICKS_PER_SECOND);
  const scale = stride / Math.hypot(dx, dy);
  const position = { x: actor.position.x + dx * scale, y: actor.position.y + dy * scale };
  const next = withEntity(state, { ...actor, position });
  return gap - stride <= CLOSE_ENOUGH ? { state: next, outcome: DONE } : { state: next };
};
