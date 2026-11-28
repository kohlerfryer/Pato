import { describe, expect, it } from "vitest";

import type { Action } from "../agent/action.ts";
import { actionRules } from "./actions.ts";
import { type Entity, type WorldState, createWorld, find } from "./state.ts";
import type { ActionRule } from "./step.ts";

const rules: Partial<Record<string, ActionRule>> = actionRules();
const duck = (over: Partial<Entity> = {}, props: Entity["props"] = {}): Entity => ({
  id: "a",
  position: { x: 0, y: 0 },
  level: 0,
  props: { speed: 3, reach: 1, ...props },
  ...over,
});
const box = (id: string, x: number, height: number, over: Partial<Entity> = {}): Entity => ({
  id,
  position: { x, y: 0 },
  level: 0,
  props: { flat_top: true, width: 2, depth: 2, height },
  ...over,
});

function act(world: WorldState, action: Action): ReturnType<ActionRule> {
  const rule = rules[action.kind];
  if (!rule) throw new Error(`no rule for ${action.kind}`);
  return rule(world, "a", action);
}
const jump: Action = { kind: "jump" };
const missed = { status: "failed", reason: "nothing_to_land_on" };

function walk(world: WorldState, x: number, ticks = 120): WorldState {
  let state = world;
  for (let i = 0; i < ticks; i++)
    state = act(state, { kind: "move_to", target: { x, y: 0 } }).state;
  return state;
}

describe("jump", () => {
  it("[S-ACT-5] lands on a flat top within reach that is one level up", () => {
    const { state, outcome } = act(createWorld([duck(), box("crate", 1.5, 1)]), jump);
    expect(outcome).toEqual({ status: "done" });
    expect(find(state, "a")).toMatchObject({ level: 1, position: { x: 1.5, y: 0 } });
  });

  it("[S-ACT-5] fails with nothing_to_land_on when the flat top is out of reach", () => {
    expect(act(createWorld([duck(), box("crate", 5, 1)]), jump).outcome).toEqual(missed);
  });

  it("[S-ACT-5] fails with nothing_to_land_on when the top is not exactly one level up", () => {
    expect(act(createWorld([duck(), box("house", 1.5, 2)]), jump).outcome).toEqual(missed);
    expect(act(createWorld([duck(), box("rug", 1.5, 0)]), jump).outcome).toEqual(missed);
  });

  it("[S-ACT-5] fails with nothing_to_land_on when the thing has no flat top", () => {
    const round = { ...box("ball", 1.5, 1), props: { width: 2, depth: 2, height: 1 } };
    expect(act(createWorld([duck(), round]), jump).outcome).toEqual(missed);
  });

  it("[S-ACT-5] counts an object's top from the level it stands on", () => {
    const stacked = box("top", 0, 1, { level: 1 });
    const { state, outcome } = act(createWorld([duck({ level: 1 }), stacked]), jump);
    expect(outcome).toEqual({ status: "done" });
    expect(find(state, "a")?.level).toBe(2);
  });

  it("[S-ACT-5] lands on the nearest of two, then the one first by id", () => {
    const near = box("crate-2", 1.2, 1);
    const farther = box("crate-1", 1.8, 1);
    expect(act(createWorld([duck(), farther, near]), jump).state.entities[0]?.position.x).toBe(1.2);
    const twin = box("b-twin", -1.2, 1);
    expect(act(createWorld([duck(), near, twin]), jump).state.entities[0]?.position.x).toBe(-1.2);
  });

  it("[S-ACT-5] takes what is held up along with the agent", () => {
    const ball: Entity = { id: "ball", position: { x: 0, y: 0 }, level: 0, props: {} };
    const holder = duck({}, { holding: "ball" });
    const { state } = act(createWorld([holder, ball, box("crate", 1.5, 1)]), jump);
    expect(find(state, "ball")).toMatchObject({ level: 1, position: { x: 1.5, y: 0 } });
  });
});

describe("falling", () => {
  const onCrate = duck({ level: 1, position: { x: 0, y: 0 } });

  it("[S-ACT-8] stays up while walking within the top it stands on", () => {
    const state = walk(createWorld([onCrate, box("crate", 0, 1)]), 0.9);
    expect(find(state, "a")?.level).toBe(1);
  });

  it("[S-ACT-8] falls to the ground on walking off the edge", () => {
    const state = walk(createWorld([onCrate, box("crate", 0, 1)]), 4);
    expect(find(state, "a")?.level).toBe(0);
  });

  it("[S-ACT-8] falls only as far as a lower top beneath", () => {
    const high = duck({ level: 2 });
    const tower = box("tower", 0, 2);
    const step = box("step", 2, 1);
    const state = walk(createWorld([high, tower, step]), 2.5);
    expect(find(state, "a")?.level).toBe(1);
  });

  it("[S-ACT-8] brings what is held down too", () => {
    const ball: Entity = { id: "ball", position: { x: 0, y: 0 }, level: 1, props: {} };
    const holding = { ...onCrate, props: { ...onCrate.props, holding: "ball" } };
    const state = walk(createWorld([holding, ball, box("crate", 0, 1)]), 4);
    expect(find(state, "ball")?.level).toBe(0);
  });
});
