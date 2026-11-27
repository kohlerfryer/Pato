import { describe, expect, it } from "vitest";

import type { Action, Outcome } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { createUse, moveTo } from "./actions.ts";
import type { PropertyRule } from "./property.ts";
import { type Entity, type WorldState, createWorld, withEntity } from "./state.ts";

const walker = (x = 0, props: Entity["props"] = {}): Entity => ({
  id: "a",
  position: { x },
  level: 0,
  props: { speed: 3, reach: 1, ...props },
});
const thing = (x: number, over: Partial<Entity> = {}): Entity => ({
  id: "b",
  position: { x },
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
    const wide = thing(10, { props: { width: 4, height: 2 } });
    const { world } = run(createWorld([walker(), wide]), to);
    expect(x(world)).toBeCloseTo(7, 6);
  });

  it("[S-ACT-3] moves in both directions along the ground", () => {
    const spot: Action = { kind: "move_to", target: { x: -3 } };
    const { world, outcome } = run(createWorld([walker(0, { reach: 0.5 })]), spot);
    expect(outcome).toEqual({ status: "done" });
    expect(x(world)).toBeCloseTo(-2.5, 6);
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

describe("use", () => {
  const handy: PropertyRule = {
    use: (state, actor, object, strength) => ({
      state: withEntity(state, { ...actor, props: { ...actor.props, used: object.id, strength } }),
      outcome: { status: "done" },
    }),
  };
  const sticky: PropertyRule = { use: (state) => ({ state }) };
  const use = createUse(
    new Map([
      ["handy", handy],
      ["sticky", sticky],
      ["plain", {}],
    ]),
  );
  const tool = (at: number, props: Entity["props"] = { handy: 7 }): Entity => thing(at, { props });
  const used = (world: WorldState): unknown => world.entities[0]?.props.used;
  const onB: Action = { kind: "use", target: "b" };

  it("[S-ACT-4] with a target applies to that object when it is within reach", () => {
    const { state, outcome } = use(createWorld([walker(), tool(1)]), "a", onB);
    expect(outcome).toEqual({ status: "done" });
    expect(state.entities[0]?.props).toMatchObject({ used: "b", strength: 7 });
  });

  it("[S-ACT-4] fails with too_far when the target is out of reach", () => {
    const before = createWorld([walker(), tool(1.5)]);
    const { state, outcome } = use(before, "a", onB);
    expect(outcome).toEqual({ status: "failed", reason: "too_far" });
    expect(state).toBe(before);
  });

  it("[S-ACT-4] reaches a wide target from its edge", () => {
    const wide = tool(3, { handy: true, width: 4 });
    expect(use(createWorld([walker(), wide]), "a", onB).outcome).toEqual({ status: "done" });
  });

  it("[S-ACT-4] with no target applies to the held object, wherever that is", () => {
    const holder = walker(0, { holding: "b" });
    const { state } = use(createWorld([holder, tool(50)]), "a", { kind: "use" });
    expect(used(state)).toBe("b");
  });

  it("[S-ACT-4] fails with nothing_to_use when there is no target and nothing held", () => {
    const { outcome } = use(createWorld([walker(), tool(1)]), "a", { kind: "use" });
    expect(outcome).toEqual({ status: "failed", reason: "nothing_to_use" });
  });

  it("[S-ACT-4] fails with nothing_to_use when the target is not there", () => {
    expect(use(createWorld([walker()]), "a", onB).outcome).toEqual({
      status: "failed",
      reason: "nothing_to_use",
    });
  });

  it("[S-ACT-4] fails with no_effect on an object none of whose properties can be used", () => {
    const dull = tool(1, { plain: true, heavy: true });
    expect(use(createWorld([walker(), dull]), "a", onB).outcome).toEqual({
      status: "failed",
      reason: "no_effect",
    });
  });

  it("[S-ACT-4] lets the first usable property, by name, decide what happens", () => {
    const both = tool(1, { sticky: true, handy: 2 });
    expect(used(use(createWorld([walker(), both]), "a", onB).state)).toBe("b");
  });

  it("[S-ACT-4] carries on for as long as the property's rule gives no outcome", () => {
    const glue = tool(1, { sticky: true });
    expect(use(createWorld([walker(), glue]), "a", onB).outcome).toBeUndefined();
  });
});
