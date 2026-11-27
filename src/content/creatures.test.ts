import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createRegistry } from "../agent/registry.ts";
import { instinctsOf, loadCreatures, readCreatures } from "./creatures.ts";

const peck = {
  id: "peck",
  params: { thing: { has: ["edible"] } },
  pre: [],
  effects: [{ subject: "$self", predicate: "hunger", op: "below", value: 0.2 }],
  body: [{ kind: "use", target: "$thing" }],
};
const hen = {
  id: "hen",
  speed: 1.5,
  reach: 1,
  sight: 8,
  weights: { hunger: 1 },
  rates: { hunger: 0.01 },
  instincts: [peck],
};
const file = "content/creatures/hen.json";
const reading = (creature: unknown) => (): unknown => readCreatures({ [file]: creature });

describe("readCreatures", () => {
  it("[S-OBJ-3] reads a creature with an id, speed, reach, sight, weights, rates and instincts", () => {
    expect(readCreatures({ [file]: hen })).toEqual([hen]);
  });

  it.each([
    ["something that isn't an object", "hen"],
    ["a missing field", { id: "hen", speed: 1 }],
    ["a field it doesn't know", { ...hen, colour: "brown" }],
    ["an id that isn't the file's name", { ...hen, id: "rooster" }],
    ["a speed of zero", { ...hen, speed: 0 }],
    ["a reach that isn't a number", { ...hen, reach: "long" }],
    ["no sight", { ...hen, sight: -1 }],
    ["weights that aren't numbers", { ...hen, weights: { hunger: "lots" } }],
    ["a negative rate", { ...hen, rates: { hunger: -0.1 } }],
    ["rates that aren't a map", { ...hen, rates: [0.1] }],
    ["instincts that aren't a list", { ...hen, instincts: peck }],
    ["an instinct that isn't an object", { ...hen, instincts: ["peck"] }],
    ["an instinct with a missing field", { ...hen, instincts: [{ id: "peck", body: [] }] }],
    [
      "an instinct that says where it came from",
      { ...hen, instincts: [{ ...peck, origin: "learned" }] },
    ],
    [
      "an instinct whose body isn't the five actions",
      { ...hen, instincts: [{ ...peck, body: [{ kind: "fly" }] }] },
    ],
    [
      "an instinct whose conditions aren't lists",
      { ...hen, instincts: [{ ...peck, pre: "none" }] },
    ],
  ])("[S-OBJ-3] refuses %s, naming the file", (_what, creature) => {
    expect(reading(creature)).toThrow(file);
  });
});

describe("loadCreatures", () => {
  it("[S-OBJ-3] loads every file in content/creatures", () => {
    const onDisk = readdirSync("content/creatures").map((name) => name.replace(/\.json$/, ""));
    expect(loadCreatures().map((creature) => creature.id)).toEqual(onDisk.sort());
    expect(onDisk.length).toBeGreaterThan(0);
  });
});

describe("instinctsOf", () => {
  it("[S-REG-3] turns a creature's instincts into skills with the origin instinct", () => {
    const [creature] = readCreatures({ [file]: hen });
    const skills = creature ? instinctsOf(creature) : [];
    expect(skills).toEqual([{ ...peck, origin: "instinct" }]);
  });

  it("[S-REG-3] gives skills the registry takes", () => {
    const registry = createRegistry();
    for (const creature of loadCreatures())
      for (const skill of instinctsOf(creature)) expect(registry.register(skill)).toBeNull();
    expect(registry.list().every((skill) => skill.origin === "instinct")).toBe(true);
    expect(registry.list().length).toBeGreaterThan(0);
  });
});
