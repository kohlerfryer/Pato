import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadScenarios, readScenarios } from "./scenarios.ts";

const pond = {
  id: "pond",
  horizon_s: 60,
  seeds: [1, 2],
  respawn_s: 10,
  setup: {
    objects: [{ kind: "food", at: 1 }],
    agents: [{ creature: "duck", at: 0, state: { hunger: 0.5 } }],
  },
  triggers: [{ at_s: 5, spawn: { kind: "nest", at: 3 } }],
};
const file = "content/scenarios/pond.json";
const reading = (scenario: unknown) => (): unknown => readScenarios({ [file]: scenario });
const setup = (over: object): unknown => ({ ...pond, setup: { ...pond.setup, ...over } });

describe("readScenarios", () => {
  it("[S-EVAL-1] reads a scenario with a setup, timed triggers, a horizon and seeds", () => {
    expect(readScenarios({ [file]: pond })).toEqual([pond]);
  });

  it.each([
    ["something that isn't an object", null],
    ["a missing field", { id: "pond", seeds: [1] }],
    ["a field it doesn't know", { ...pond, weather: "rain" }],
    ["an id that isn't the file's name", { ...pond, id: "lake" }],
    ["a horizon of zero", { ...pond, horizon_s: 0 }],
    ["no seeds", { ...pond, seeds: [] }],
    ["a seed that isn't a whole number", { ...pond, seeds: [1.5] }],
    ["a negative delay", { ...pond, respawn_s: -1 }],
    ["a setup that isn't an object", { ...pond, setup: [] }],
    ["a setup with no agents list", { ...pond, setup: { objects: [] } }],
    ["an object with no kind", setup({ objects: [{ at: 1 }] })],
    ["an object placed nowhere", setup({ objects: [{ kind: "food", at: "left" }] })],
    [
      "an object with a field it doesn't know",
      setup({ objects: [{ kind: "food", at: 1, big: true }] }),
    ],
    ["an agent with no creature", setup({ agents: [{ at: 0, state: {} }] })],
    [
      "an agent whose state isn't numbers",
      setup({ agents: [{ creature: "duck", at: 0, state: { hunger: "lots" } }] }),
    ],
    ["triggers that aren't a list", { ...pond, triggers: {} }],
    ["a trigger with no time", { ...pond, triggers: [{ spawn: { kind: "nest", at: 3 } }] }],
    [
      "a trigger before the start",
      { ...pond, triggers: [{ at_s: -1, spawn: { kind: "nest", at: 3 } }] },
    ],
    ["a trigger that spawns nothing", { ...pond, triggers: [{ at_s: 5, spawn: {} }] }],
  ])("[S-EVAL-1] refuses %s, naming the file", (_what, scenario) => {
    expect(reading(scenario)).toThrow(file);
  });
});

describe("loadScenarios", () => {
  it("[S-EVAL-1] loads every file in content/scenarios, in name order", () => {
    const onDisk = readdirSync("content/scenarios").map((name) => name.replace(/\.json$/, ""));
    expect(loadScenarios().map((scenario) => scenario.id)).toEqual(onDisk.sort());
    expect(onDisk.length).toBeGreaterThan(0);
  });
});
