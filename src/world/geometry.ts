/** Distances between things, with each thing's size taken as half the longer side of its footprint. */

import { type Entity, amount } from "./state.ts";

/** Closer than this counts as touching, so rounding never decides anything. */
export const CLOSE_ENOUGH = 1e-9;

export function radius(entity: Entity): number {
  return Math.max(amount(entity, "width"), amount(entity, "depth")) / 2;
}

/** The distance between two entities' centres. */
export function apart(a: Entity, b: Entity): number {
  return Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
}

/** Whether `object` is close enough for `actor` to use, measured from the object's edge. */
export function withinReach(actor: Entity, object: Entity): boolean {
  return apart(actor, object) - radius(object) - amount(actor, "reach") <= CLOSE_ENOUGH;
}

/** Whether the straight line from `from` to `to` passes through `blocker`'s footprint. */
export function crosses(from: Entity, to: Entity, blocker: Entity): boolean {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const length = dx * dx + dy * dy;
  const along =
    length === 0
      ? 0
      : ((blocker.position.x - from.position.x) * dx +
          (blocker.position.y - from.position.y) * dy) /
        length;
  const t = Math.min(1, Math.max(0, along));
  const nearest = { x: from.position.x + dx * t, y: from.position.y + dy * t };
  return (
    Math.hypot(blocker.position.x - nearest.x, blocker.position.y - nearest.y) < radius(blocker)
  );
}
