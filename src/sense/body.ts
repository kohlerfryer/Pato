/** The body sense: what an agent can tell about itself, every tick. */

import type { Sensor } from "../kernel/loop.ts";
import { find } from "../world/state.ts";
import { stamper } from "./stamp.ts";

/** A body reading stays believed this long. It is renewed every tick. */
const BODY_TTL = 2;

/**
 * `states` are told as they are (hunger is 0.4). `relations` name something else (holding is the
 * id of what is held) and are told as a link to it.
 */
export function createBody(words: {
  readonly states: readonly string[];
  readonly relations: readonly string[];
}): Sensor {
  return ({ t, world, self }) => {
    const entity = find(world, self);
    if (!entity) return [];
    const own: Readonly<Record<string, boolean | number | string>> = {
      ...entity.props,
      level: entity.level,
    };
    const stamp = stamper("body", t, BODY_TTL);
    const states = words.states.flatMap((predicate) => {
      const value = own[predicate];
      return value === undefined ? [] : [stamp({ subject: self, predicate, value })];
    });
    const relations = words.relations.flatMap((predicate) => {
      const object = own[predicate];
      return typeof object === "string"
        ? [stamp({ subject: self, predicate, object, value: true })]
        : [];
    });
    return [...states, ...relations];
  };
}
