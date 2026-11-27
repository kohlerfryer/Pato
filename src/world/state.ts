/** What exists in the world. A state is never changed in place: the step function returns the next one. */

import type { EntityId } from "../agent/fact.ts";

export interface Entity {
  readonly id: EntityId;
  /** How far along the ground it is. Height is its level. */
  readonly position: { readonly x: number };
  /** Height: the ground is 0, a crate's top is 1, a roof is 2. */
  readonly level: number;
  /** What it is like. Behaviour belongs to properties, never to ids. */
  readonly props: Readonly<Record<string, boolean | number | string>>;
}

export interface WorldState {
  readonly entities: readonly Entity[];
  /** Things that were used up and are on their way back, with the ticks left until they return. */
  readonly away: readonly { readonly entity: Entity; readonly ticks: number }[];
  /** How many ticks a used-up thing stays away. Zero means it never comes back. */
  readonly respawn: number;
}

const frozenEntity = (entity: Entity): Entity =>
  Object.freeze({
    ...entity,
    position: Object.freeze({ ...entity.position }),
    props: Object.freeze({ ...entity.props }),
  });

/** A copy of `state` that throws if anything tries to change it. */
export function frozen(state: WorldState): WorldState {
  const away = state.away.map(({ entity, ticks }) =>
    Object.freeze({ entity: frozenEntity(entity), ticks }),
  );
  return Object.freeze({
    entities: Object.freeze(state.entities.map(frozenEntity)),
    away: Object.freeze(away),
    respawn: state.respawn,
  });
}

export function createWorld(entities: readonly Entity[], respawn = 0): WorldState {
  return frozen({ entities, away: [], respawn });
}

export function find(state: WorldState, id: EntityId): Entity | undefined {
  return state.entities.find((entity) => entity.id === id);
}

/** `state` with `entity` in place of the one that has its id. */
export function withEntity(state: WorldState, entity: Entity): WorldState {
  return {
    ...state,
    entities: state.entities.map((each) => (each.id === entity.id ? entity : each)),
  };
}

/** A numeric property of `entity`, or 0 if it has none by that name. */
export function amount(entity: Entity, name: string): number {
  const value = entity.props[name];
  return typeof value === "number" ? value : 0;
}
