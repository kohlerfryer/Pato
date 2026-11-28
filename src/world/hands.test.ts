import { describe, expect, it } from "vitest";

import type { Action } from "../agent/action.ts";
import { actionRules } from "./actions.ts";
import { type Entity, type WorldState, createWorld, find } from "./state.ts";
import type { ActionRule } from "./step.ts";

const rules = actionRules();
const duck = (props: Entity["props"] = {}): Entity => ({
  id: "a",
  position: { x: 0, y: 0 },
  level: 0,
  props: { speed: 3, reach: 1, ...props },
});
const ball = (x = 1, props: Entity["props"] = { grabbable: true }): Entity => ({
  id: "b",
  position: { x, y: 0 },
  level: 0,
  props,
});
const grabB: Action = { kind: "grab", target: "b" };
const drop: Action = { kind: "drop" };

function act(world: WorldState, action: Action): ReturnType<ActionRule> {
  const rule: ActionRule | undefined = (rules as Partial<Record<string, ActionRule>>)[action.kind];
  if (!rule) throw new Error(`no rule for ${action.kind}`);
  return rule(world, "a", action);
}
const failure = (reason: string): unknown => ({ status: "failed", reason });

describe("grab", () => {
  it("[S-ACT-6] picks up a grabbable object within reach", () => {
    const { state, outcome } = act(createWorld([duck(), ball()]), grabB);
    expect(outcome).toEqual({ status: "done" });
    expect(find(state, "a")?.props.holding).toBe("b");
  });

  it("[S-ACT-6] fails with too_far when the object is out of reach", () => {
    expect(act(createWorld([duck(), ball(5)]), grabB).outcome).toEqual(failure("too_far"));
  });

  it("[S-ACT-6] fails with not_grabbable on an object that is not grabbable, or not there", () => {
    const heavy = ball(1, { grabbable: false });
    expect(act(createWorld([duck(), heavy]), grabB).outcome).toEqual(failure("not_grabbable"));
    expect(act(createWorld([duck()]), grabB).outcome).toEqual(failure("not_grabbable"));
  });

  it("[S-ACT-6] fails with hands_full while already holding something", () => {
    const full = duck({ holding: "c" });
    expect(act(createWorld([full, ball()]), grabB).outcome).toEqual(failure("hands_full"));
  });

  it("[S-ACT-6] carries the held object along as the agent moves", () => {
    let state = act(createWorld([duck(), ball()]), grabB).state;
    const away: Action = { kind: "move_to", target: { x: 9, y: 4 } };
    for (let i = 0; i < 60; i++) state = act(state, away).state;
    const [mover, held] = [find(state, "a"), find(state, "b")];
    expect(mover?.position.x).toBeGreaterThan(5);
    expect(held?.position).toEqual(mover?.position);
    expect(held?.level).toBe(mover?.level);
  });
});

describe("drop", () => {
  it("[S-ACT-7] puts the held object down at the agent's position and level", () => {
    const high = { ...duck({ holding: "b" }), position: { x: 3, y: 2 }, level: 1 };
    const { state, outcome } = act(createWorld([high, ball(8)]), drop);
    expect(outcome).toEqual({ status: "done" });
    expect(find(state, "b")).toMatchObject({ position: { x: 3, y: 2 }, level: 1 });
    expect(find(state, "a")?.props).not.toHaveProperty("holding");
  });

  it("[S-ACT-7] leaves the object where it was put down when the agent walks away", () => {
    let state = act(createWorld([duck({ holding: "b" }), ball()]), drop).state;
    for (let i = 0; i < 30; i++)
      state = act(state, { kind: "move_to", target: { x: 9, y: 0 } }).state;
    expect(find(state, "b")?.position).toEqual({ x: 0, y: 0 });
  });

  it("[S-ACT-7] fails with nothing_held when the agent holds nothing", () => {
    expect(act(createWorld([duck(), ball()]), drop).outcome).toEqual(failure("nothing_held"));
  });
});
