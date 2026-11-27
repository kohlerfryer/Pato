/** Needs grow on their own: any property with a matching `_rate` rises by that much each second. */

import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type Entity, amount } from "./state.ts";

const RATE = "_rate";
const FULL = 1;

/** `entity` one tick later: each need a little higher, and none above 1. */
export function grow(entity: Entity): Entity {
  const rates = Object.keys(entity.props).filter((key) => key.endsWith(RATE));
  if (rates.length === 0) return entity;
  const props = { ...entity.props };
  for (const key of rates) {
    const need = key.slice(0, -RATE.length);
    props[need] = Math.min(FULL, amount(entity, need) + amount(entity, key) / TICKS_PER_SECOND);
  }
  return { ...entity, props };
}
