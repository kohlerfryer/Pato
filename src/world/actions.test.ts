import { describe, expect, it } from "vitest";

import type { Action, Outcome } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { moveTo } from "./actions.ts";
import { type Entity, type WorldState, createWorld } from "./state.ts";

const walker = (x = 0, props: Entity["props"] = {}): Entity => ({
  id: "a",
  position: { x, y: 0 },
  level: 0,
  props: { speed: 3, reach: 1, ...props },
});
const thing = (x: number, over: Partial<Entity> = {}): Entity => ({
  id: "b",
  position: { x, y: 0 },
  level: 0,
  props: {},
  ...over,
});

/** Runs `action` for actor `a` until it ends or `limit` ticks pass. */
function run(
  world: WorldState,
  action: Action,
  limit = 1000,
): { ticks: number; world: WorldState; outcome: Outcome | undefined } {
  let state = world;
  for (let ticks = 1; ticks <= limit; ticks++) {
    const result = moveTo(state, "a", action);
    state = result.state;
    if (result.outcome) return { ticks, world: state, outcome: result.outcome };
  }
  return { ticks: limit, world: state, outcome: undefined };
}

const x = (world: WorldState): number => world.entities[0]?.position.x ?? Number.NaN;
const to: Action = { kind: "move_to", target: "b" };

describe("move_to", () => {
  it("[S-ACT-3] moves the agent toward its target at the creature's speed", () => {
    const { state, outcome } = moveTo(createWorld([walker(), thing(10)]), "a", to);
    expect(x(state)).toBeCloseTo(3 / TICKS_PER_SECOND, 10);
    expect(outcome).toBeUndefined();
  });

  it("[S-ACT-3] ends done as soon as the target is within reach, without overshooting", () => {
    const { ticks, world, outcome } = run(createWorld([walker(), thing(10)]), to);
    expect(outcome).toEqual({ status: "done" });
    expect(x(world)).toBeCloseTo(9, 6);
    expect(ticks).toBe(Math.ceil((9 / 3) * TICKS_PER_SECOND));
  });

  it("[S-ACT-3] is done at once when the target is already within reach", () => {
    const { ticks, world } = run(createWorld([walker(9.5), thing(10)]), to);
    expect(ticks).toBe(1);
    expect(x(world)).toBe(9.5);
  });

  it("[S-ACT-3] counts a wide target as within reach from its edge", () => {
    const wide = thing(10, { props: { width: 4, depth: 2 } });
    const { world } = run(createWorld([walker(), wide]), to);
    expect(x(world)).toBeCloseTo(7, 6);
  });

  it("[S-ACT-3] moves in both directions and on both axes", () => {
    const spot: Action = { kind: "move_to", target: { x: -3, y: -4 } };
    const { world, outcome } = run(createWorld([walker(0, { reach: 0.5 })]), spot);
    const [a] = world.entities;
    expect(outcome).toEqual({ status: "done" });
    expect(Math.hypot((a?.position.x ?? 0) + 3, (a?.position.y ?? 0) + 4)).toBeCloseTo(0.5, 6);
  });

  it("[S-ACT-3] fails with unreachable when the target is on another level", () => {
    const { outcome, world } = run(createWorld([walker(), thing(10, { level: 1 })]), to);
    expect(outcome).toEqual({ status: "failed", reason: "unreachable" });
    expect(x(world)).toBe(0);
  });

  it("[S-ACT-3] fails with unreachable when the target is not there", () => {
    expect(run(createWorld([walker()]), to).outcome).toEqual({
      status: "failed",
      reason: "unreachable",
    });
  });

  it("[S-ACT-3] stays put when the creature has no speed", () => {
    const { outcome, world } = run(createWorld([walker(0, { speed: 0 }), thing(10)]), to, 5);
    expect(outcome).toBeUndefined();
    expect(x(world)).toBe(0);
  });

  it("[S-ACT-3] leaves everything else where it was", () => {
    const { state } = moveTo(createWorld([walker(), thing(10)]), "a", to);
    expect(state.entities[1]).toEqual(thing(10));
  });
});
