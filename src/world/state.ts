/** What exists in the world. A state is never changed in place: the step function returns the next one. */

import type { EntityId } from "../agent/fact.ts";

export interface Entity {
  readonly id: EntityId;
  readonly position: { readonly x: number; readonly y: number };
  /** Height: the ground is 0, a crate's top is 1, a roof is 2. */
  readonly level: number;
  /** What it is like. Behaviour belongs to properties, never to ids. */
  readonly props: Readonly<Record<string, boolean | number | string>>;
}

export interface WorldState {
  readonly entities: readonly Entity[];
}

/** A copy of `state` that throws if anything tries to change it. */
export function frozen(state: WorldState): WorldState {
  const entities = state.entities.map((entity) =>
    Object.freeze({
      ...entity,
      position: Object.freeze({ ...entity.position }),
      props: Object.freeze({ ...entity.props }),
    }),
  );
  return Object.freeze({ entities: Object.freeze(entities) });
}

export function createWorld(entities: readonly Entity[]): WorldState {
  return frozen({ entities });
}
