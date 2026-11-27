import { describe, expect, it } from "vitest";

import type { Action } from "../agent/action.ts";
import { type Entity, type WorldState, createWorld } from "./state.ts";
import { type ActionRule, step } from "./step.ts";

const thing = (id: string, x = 0): Entity => ({
  id,
  position: { x },
  level: 0,
  props: { grabbable: true },
});

/** A stand-in rule: an entity that jumps goes up one level and is done. */
const rise: ActionRule = (state, actor) => ({
  state: {
    ...state,
    entities: state.entities.map((entity) =>
      entity.id === actor ? { ...entity, level: entity.level + 1 } : entity,
    ),
  },
  outcome: { status: "done" },
});

const jump: Action = { kind: "jump" };
const levels = (state: WorldState): number[] => state.entities.map((entity) => entity.level);

describe("world state", () => {
  it("[S-WORLD-1] is a list of entities with an id, a position, a level and properties", () => {
    const world = createWorld([thing("a", 3)]);
    expect(world.entities).toEqual([
      { id: "a", position: { x: 3 }, level: 0, props: { grabbable: true } },
    ]);
  });

  it("[S-WORLD-1] can't be changed in place", () => {
    const world = createWorld([thing("a")]);
    const [entity] = world.entities as Entity[];
    expect(() => {
      (world.entities as Entity[]).push(thing("b"));
    }).toThrow(TypeError);
    expect(() => {
      (entity as { level: number }).level = 2;
    }).toThrow(TypeError);
    expect(() => {
      (entity?.position as { x: number }).x = 9;
    }).toThrow(TypeError);
    expect(() => {
      (entity?.props as Record<string, boolean>).grabbable = false;
    }).toThrow(TypeError);
  });

  it("[S-WORLD-1] is not tied to the list it was made from", () => {
    const list = [thing("a")];
    const world = createWorld(list);
    list.push(thing("b"));
    expect(world.entities).toHaveLength(1);
  });
});

describe("step", () => {
  it("[S-WORLD-1] returns the next state and leaves the one it was given alone", () => {
    const before = createWorld([thing("a"), thing("b")]);
    const { state } = step(before, new Map([["a", jump]]), { jump: rise });
    expect(levels(state)).toEqual([1, 0]);
    expect(levels(before)).toEqual([0, 0]);
  });

  it("[S-WORLD-1] returns a state that can't be changed in place either", () => {
    const { state } = step(createWorld([thing("a")]), new Map([["a", jump]]), { jump: rise });
    expect(() => {
      (state.entities[0] as { level: number }).level = 5;
    }).toThrow(TypeError);
  });

  it("[S-WORLD-1] reports how each action ended, by actor", () => {
    const { outcomes } = step(createWorld([thing("a")]), new Map([["a", jump]]), { jump: rise });
    expect(outcomes.get("a")).toEqual({ status: "done" });
  });

  it("[S-WORLD-1] reports nothing for an action that is still going", () => {
    const slow: ActionRule = (state) => ({ state });
    const { outcomes } = step(createWorld([thing("a")]), new Map([["a", jump]]), { jump: slow });
    expect(outcomes.has("a")).toBe(false);
  });

  it("[S-WORLD-1] applies actions in actor id order, whatever order they were asked in", () => {
    const seen: string[] = [];
    const watch: ActionRule = (state, actor) => {
      seen.push(actor);
      return { state };
    };
    step(
      createWorld([thing("a"), thing("b")]),
      new Map([
        ["b", jump],
        ["a", jump],
      ]),
      { jump: watch },
    );
    expect(seen).toEqual(["a", "b"]);
  });

  it("[S-ACT-2] fails an action the world has no rule for, and says why", () => {
    const before = createWorld([thing("a")]);
    const { state, outcomes } = step(before, new Map([["a", jump]]), {});
    expect(outcomes.get("a")).toEqual({ status: "failed", reason: "no_rule" });
    expect(state).toEqual(before);
  });
});
