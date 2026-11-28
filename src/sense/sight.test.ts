import { describe, expect, it } from "vitest";

import type { Fact } from "../agent/fact.ts";
import type { PropertyRule } from "../world/property.ts";
import { type Entity, createWorld } from "../world/state.ts";
import { createSight } from "./sight.ts";

const me: Entity = { id: "a", position: { x: 0, y: 0 }, level: 0, props: { sight: 10, reach: 1 } };
const at = (
  id: string,
  x: number,
  y: number,
  props: Entity["props"] = { kind: "snack" },
): Entity => ({
  id,
  position: { x, y },
  level: 0,
  props,
});
const kinds = new Map([
  ["snack", { looks: ["edible"] }],
  ["wall", { looks: ["tall"] }],
  ["mystery", { looks: [] }],
]);
const walls = new Map<string, PropertyRule>([
  ["tall", { blocksSight: (strength) => strength === true }],
  ["edible", {}],
]);
const random = (): number => 0;

function see(others: Entity[], rules = walls): Fact[] {
  const sight = createSight(kinds, rules);
  return [...sight({ t: 5, world: createWorld([me, ...others]), self: "a", random })];
}
/** What sight told, in words, leaving out positions, which are checked on their own. */
const told = (facts: Fact[]): string[] =>
  facts
    .filter(({ predicate }) => predicate !== "at")
    .map(({ subject, predicate, object, value }) =>
      [subject, predicate, object, String(value)].filter((part) => part !== undefined).join(" "),
    );

describe("sight", () => {
  it("[S-SENSE-1] tells the properties in an object's looks, and how the object stands to the agent", () => {
    const snack = at("b", 0.5, 0, { kind: "snack", edible: 0.6, weight: 2 });
    expect(told(see([snack]))).toEqual(["b edible true", "a near b true"]);
  });

  it("[S-SENSE-1] stamps each fact with the tick, its source and full confidence", () => {
    const [fact] = see([at("b", 3, 0)]);
    expect(fact).toMatchObject({ tEvent: 5, source: "sight", confidence: 1 });
    expect(fact?.ttl).toBeGreaterThan(0);
  });

  it("[S-SENSE-1] says an object out of reach is not near", () => {
    expect(told(see([at("b", 3, 0)]))).toEqual(["b edible true", "a near b false"]);
  });

  it("[S-SENSE-1] measures reach from the object's edge", () => {
    const wide = at("b", 3, 0, { kind: "snack", width: 4, depth: 1 });
    expect(told(see([wide]))).toContain("a near b true");
  });

  it("[S-SENSE-1] tells nothing of an entity beyond sight range", () => {
    expect(see([at("b", 10.5, 0)])).toEqual([]);
    expect(told(see([at("b", 6, 8)]))).toEqual(["b edible true", "a near b false"]);
  });

  it("[S-SENSE-1] tells nothing of the agent itself", () => {
    expect(see([])).toEqual([]);
  });

  it("[S-SENSE-1] tells only how an object stands when its kind has no looks, or is unknown", () => {
    expect(told(see([at("b", 3, 0, { kind: "mystery" }), at("c", 0, 3, {})]))).toEqual([
      "a near b false",
      "a near c false",
    ]);
  });

  it("[S-SENSE-1] tells nothing of an entity hidden behind something that blocks the view", () => {
    const wall = at("w", 3, 0, { kind: "wall", tall: true, width: 2, depth: 2 });
    const hidden = at("b", 6, 0);
    expect(told(see([wall, hidden]))).toEqual(["w tall true", "a near w false"]);
  });

  it("[S-SENSE-1] still sees past a blocker that is off the line of sight", () => {
    const wall = at("w", 3, 4, { kind: "wall", tall: true, width: 2, depth: 2 });
    expect(told(see([wall, at("b", 6, 0)]))).toContain("b edible true");
  });

  it("[S-SENSE-1] still sees what stands in front of a blocker", () => {
    const wall = at("w", 6, 0, { kind: "wall", tall: true, width: 2, depth: 2 });
    expect(told(see([wall, at("b", 3, 0)]))).toContain("b edible true");
  });

  it("[S-SENSE-1] sees through an object whose properties block nothing", () => {
    const low = at("w", 3, 0, { kind: "wall", tall: false, width: 2, depth: 2 });
    expect(told(see([low, at("b", 6, 0)]))).toContain("b edible true");
  });

  it("[S-SENSE-1] sees nothing when the agent is not in the world", () => {
    const sight = createSight(kinds, walls);
    expect(sight({ t: 1, world: createWorld([at("b", 1, 0)]), self: "a", random })).toEqual([]);
  });
});

describe("what sight leaves out", () => {
  it("[S-SENSE-3] never tells a property that is not in the object's looks", () => {
    const secret = at("b", 2, 0, { kind: "mystery", edible: 0.6, tall: true });
    expect(told(see([secret]))).toEqual(["a near b false"]);
    const snack = at("c", 2, 0, { kind: "snack", edible: 0.6, tall: true });
    expect(told(see([snack]))).toEqual(["c edible true", "a near c false"]);
  });

  it("[S-SENSE-3] tells nothing of a thing whose kind it does not know", () => {
    expect(told(see([at("b", 2, 0, { edible: 0.6 })]))).toEqual(["a near b false"]);
  });
});

describe("where things are", () => {
  it("[S-SENSE-4] tells where each thing in view stands, along, across and up", () => {
    const high = { ...at("b", 2.004, -3), level: 1 };
    const where = see([high]).find(({ predicate }) => predicate === "at");
    expect(where).toMatchObject({ subject: "b", value: "2,-3,1", source: "sight" });
  });
});
