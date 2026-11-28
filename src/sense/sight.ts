/**
 * Sight: what an agent can tell by looking. The engine knows everything exactly; this decides what
 * the agent is told, which is only what is in range, in view, and visible at a glance.
 */

import type { Sensor } from "../kernel/loop.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { apart, crosses, withinReach } from "../world/geometry.ts";
import type { PropertyRule } from "../world/property.ts";
import { type Entity, amount, find } from "../world/state.ts";
import { stamper } from "./stamp.ts";

/** What is seen stays believed this long after it was last seen. */
const SIGHT_TTL = TICKS_PER_SECOND;

/** For each kind of object, which of its properties show at a glance. */
type Kinds = ReadonlyMap<string, { readonly looks: readonly string[] }>;

/** Where a thing stands, as "along,across,level", to the hundredth. */
const where = ({ position, level }: Entity): string =>
  [position.x, position.y]
    .map((n) => Number(n.toFixed(2)))
    .concat(level)
    .join(",");

export function createSight(kinds: Kinds, rules: ReadonlyMap<string, PropertyRule>): Sensor {
  const blocksSight = (entity: Entity): boolean =>
    Object.entries(entity.props).some(([name, strength]) =>
      rules.get(name)?.blocksSight?.(strength),
    );

  return ({ t, world, self }) => {
    const viewer = find(world, self);
    if (!viewer) return [];
    const stamp = stamper("sight", t, SIGHT_TTL);
    const others = world.entities.filter((entity) => entity.id !== self);
    const blockers = others.filter(blocksSight);
    const hidden = (entity: Entity): boolean =>
      blockers.some((blocker) => blocker.id !== entity.id && crosses(viewer, entity, blocker));
    return others
      .filter((entity) => apart(viewer, entity) <= amount(viewer, "sight") && !hidden(entity))
      .flatMap((entity) => [
        ...(kinds.get(String(entity.props.kind))?.looks ?? []).map((name) =>
          stamp({ subject: entity.id, predicate: name, value: true }),
        ),
        stamp({ subject: entity.id, predicate: "at", value: where(entity) }),
        stamp({
          subject: self,
          predicate: "near",
          object: entity.id,
          value: withinReach(viewer, entity),
        }),
      ]);
  };
}
