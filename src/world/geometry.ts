/** Distances along the ground, with each thing's size taken as half its width. */

import { type Entity, amount } from "./state.ts";

/** Closer than this counts as touching, so rounding never decides anything. */
export const CLOSE_ENOUGH = 1e-9;

export function radius(entity: Entity): number {
  return amount(entity, "width") / 2;
}

/** The distance between two entities' centres. */
export function apart(a: Entity, b: Entity): number {
  return Math.abs(b.position.x - a.position.x);
}

/** Whether `object` is close enough for `actor` to use, measured from the object's edge. */
export function withinReach(actor: Entity, object: Entity): boolean {
  return apart(actor, object) - radius(object) - amount(actor, "reach") <= CLOSE_ENOUGH;
}

/** Whether `blocker` stands on the ground between `from` and `to`. */
export function crosses(from: Entity, to: Entity, blocker: Entity): boolean {
  const low = Math.min(from.position.x, to.position.x);
  const high = Math.max(from.position.x, to.position.x);
  const nearest = Math.min(high, Math.max(low, blocker.position.x));
  return Math.abs(blocker.position.x - nearest) < radius(blocker);
}
