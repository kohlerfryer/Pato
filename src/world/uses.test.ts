import { describe, expect, it } from "vitest";

import type { Action } from "../agent/action.ts";
import { actionRules } from "./actions.ts";
import { type Entity, createWorld, find } from "./state.ts";
import { type UseStep, applyUse, useProblem } from "./uses.ts";

const duck: Entity = {
  id: "a",
  position: { x: 0, y: 0 },
  level: 0,
  props: { reach: 1, hunger: 0.5 },
};
const brolly = (props: Entity["props"] = {}): Entity => ({
  id: "b",
  position: { x: 0.5, y: 0 },
  level: 0,
  props: { kind: "brolly", open: false, ...props },
});
const after = (steps: UseStep[], thing = brolly()) =>
  applyUse(createWorld([duck, thing]), duck, thing, steps);

describe("use effects", () => {
  it("[S-WORLD-8] toggles a state of the thing used", () => {
    expect(find(after([{ toggle: "open" }]), "b")?.props.open).toBe(true);
    expect(find(after([{ toggle: "open" }], brolly({ open: true })), "b")?.props.open).toBe(false);
  });

  it("[S-WORLD-8] sets a fact about the thing used", () => {
    expect(find(after([{ set: { colour: "red", size: 2 } }]), "b")?.props).toMatchObject({
      colour: "red",
      size: 2,
    });
  });

  it("[S-WORLD-8] adds and removes a property", () => {
    const added = after([{ add: "roof" }]);
    expect(find(added, "b")?.props.roof).toBe(true);
    const removed = after([{ remove: "roof" }], brolly({ roof: true }));
    expect(find(removed, "b")?.props).not.toHaveProperty("roof");
  });

  it("[S-WORLD-8] changes a drive of whoever uses it, kept between 0 and 1", () => {
    expect(find(after([{ change: { hunger: -0.2 } }]), "a")?.props.hunger).toBeCloseTo(0.3, 9);
    expect(find(after([{ change: { hunger: -2, sleepiness: 0.4 } }]), "a")?.props).toMatchObject({
      hunger: 0,
      sleepiness: 0.4,
    });
  });

  it("[S-WORLD-8] applies its steps in order", () => {
    const thing = find(after([{ add: "roof" }, { toggle: "open" }, { remove: "roof" }]), "b");
    expect(thing?.props).toMatchObject({ open: true });
    expect(thing?.props).not.toHaveProperty("roof");
  });

  it.each([
    ["a list of steps", [{ toggle: "open" }, { add: "roof" }]],
    ["no steps", []],
  ])("[S-WORLD-8] accepts %s", (_what, steps) => {
    expect(useProblem(steps)).toBeNull();
  });

  it.each([
    ["something that is not a list", { toggle: "open" }],
    ["a step of an unknown kind", [{ explode: true }]],
    ["a step doing two things", [{ toggle: "open", add: "roof" }]],
    ["a toggle without a name", [{ toggle: 3 }]],
    ["a change that isn't numbers", [{ change: { hunger: "less" } }]],
    ["a set of something that isn't plain", [{ set: { colour: { r: 1 } } }]],
  ])("[S-WORLD-8] refuses %s", (_what, steps) => {
    expect(useProblem(steps)).not.toBeNull();
  });

  it("[S-WORLD-8] is what using a thing does, on top of its properties, when its kind has one", () => {
    const rules = actionRules(new Map([["brolly", [{ toggle: "open" }]]]));
    const use: Action = { kind: "use", target: "b" };
    const { state, outcome } = rules.use(createWorld([duck, brolly()]), "a", use);
    expect(outcome).toEqual({ status: "done" });
    expect(find(state, "b")?.props.open).toBe(true);
    expect(actionRules().use(createWorld([duck, brolly()]), "a", use).outcome).toEqual({
      status: "failed",
      reason: "no_effect",
    });
  });
});
