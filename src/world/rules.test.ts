import { describe, expect, it } from "vitest";

import type { Action, Outcome } from "../agent/action.ts";
import { loadVocabulary } from "../content/vocabulary.ts";
import { sources } from "../evals/sources.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { actionRules } from "./actions.ts";
import { propertyRules } from "./property.ts";
import { type Entity, type WorldState, createWorld } from "./state.ts";
import { step } from "./step.ts";

const duck = (props: Entity["props"]): Entity => ({
  id: "a",
  position: { x: 0 },
  level: 0,
  props: { reach: 1, ...props },
});
const item = (props: Entity["props"]): Entity => ({
  id: "b",
  position: { x: 0.5 },
  level: 0,
  props,
});
const useB: Action = { kind: "use", target: "b" };
const rules = actionRules();

function useOnce(world: WorldState): { world: WorldState; outcome: Outcome | undefined } {
  const { state, outcomes } = step(world, new Map([["a", useB]]), rules);
  return { world: state, outcome: outcomes.get("a") };
}
const idle = (world: WorldState, ticks: number): WorldState => {
  let state = world;
  for (let i = 0; i < ticks; i++) state = step(state, new Map(), rules).state;
  return state;
};
const ids = (world: WorldState): string[] => world.entities.map((entity) => entity.id);
const level = (world: WorldState, need: string): unknown => world.entities[0]?.props[need];

describe("edible", () => {
  const food = item({ edible: 0.6 });

  it("[S-WORLD-3] using it removes it and lowers the user's hunger by its amount", () => {
    const { world, outcome } = useOnce(createWorld([duck({ hunger: 0.9 }), food]));
    expect(outcome).toEqual({ status: "done" });
    expect(ids(world)).toEqual(["a"]);
    expect(level(world, "hunger")).toBeCloseTo(0.3, 10);
  });

  it("[S-WORLD-3] never takes hunger below zero", () => {
    expect(level(useOnce(createWorld([duck({ hunger: 0.2 }), food])).world, "hunger")).toBe(0);
  });

  it("[S-WORLD-3] reappears where it was after the scenario's delay", () => {
    const eaten = useOnce(createWorld([duck({ hunger: 0.9 }), food], 90)).world;
    expect(ids(idle(eaten, 89))).toEqual(["a"]);
    const later = idle(eaten, 90);
    expect(ids(later)).toEqual(["a", "b"]);
    expect(later.entities[1]).toEqual(food);
  });

  it("[S-WORLD-3] stays gone when the scenario has no delay", () => {
    const eaten = useOnce(createWorld([duck({ hunger: 0.9 }), food])).world;
    expect(ids(idle(eaten, 500))).toEqual(["a"]);
  });

  it("[S-WORLD-3] can be eaten again once it is back", () => {
    const back = idle(useOnce(createWorld([duck({ hunger: 1 }), food], 5)).world, 5);
    const again = useOnce(back);
    expect(again.outcome).toEqual({ status: "done" });
    expect(ids(again.world)).toEqual(["a"]);
  });
});

describe("soft", () => {
  const nest = item({ soft: 0.3 });

  it("[S-WORLD-4] using it lowers sleepiness each tick, for as long as it goes on", () => {
    const first = useOnce(createWorld([duck({ sleepiness: 0.5 }), nest]));
    expect(first.outcome).toBeUndefined();
    expect(level(first.world, "sleepiness")).toBeCloseTo(0.5 - 0.3 / TICKS_PER_SECOND, 10);
    const second = useOnce(first.world);
    expect(level(second.world, "sleepiness")).toBeCloseTo(0.5 - 0.6 / TICKS_PER_SECOND, 10);
  });

  it("[S-WORLD-4] is done when sleepiness reaches zero, and not before", () => {
    let world = createWorld([duck({ sleepiness: 0.1 }), nest]);
    let ticks = 0;
    let outcome: Outcome | undefined;
    while (!outcome && ticks < 100) {
      ({ world, outcome } = useOnce(world));
      ticks += 1;
    }
    expect(outcome).toEqual({ status: "done" });
    expect(level(world, "sleepiness")).toBe(0);
    expect(ticks).toBe(Math.round((0.1 / 0.3) * TICKS_PER_SECOND));
  });

  it("[S-WORLD-4] stops lowering sleepiness once the agent does something else", () => {
    const rested = useOnce(createWorld([duck({ sleepiness: 0.5 }), nest])).world;
    expect(level(idle(rested, 10), "sleepiness")).toBe(level(rested, "sleepiness"));
  });

  it("[S-WORLD-4] leaves the nest where it is", () => {
    expect(ids(useOnce(createWorld([duck({ sleepiness: 0.5 }), nest])).world)).toEqual(["a", "b"]);
  });
});

describe("property rules", () => {
  const properties = Object.keys(loadVocabulary().properties).sort();

  it("[S-VOCAB-2] has exactly one rule module for each property, named after it", () => {
    expect([...propertyRules().keys()].sort()).toEqual(properties);
    const modules = sources()
      .map(({ path }) => path)
      .filter((path) => path.startsWith("src/world/rules/"));
    expect(modules).toEqual(properties.map((name) => `src/world/rules/${name}.ts`));
  });

  it("[S-VOCAB-2] names no property anywhere else in the code", () => {
    const strays = sources().flatMap(({ path, text }) =>
      properties
        .filter((name) => path !== `src/world/rules/${name}.ts`)
        .filter((name) => new RegExp(`["'\`.]${name}\\b`).test(text))
        .map((name) => `${path} names ${name}`),
    );
    expect(strays).toEqual([]);
  });
});
