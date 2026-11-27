import { describe, expect, it } from "vitest";

import type { Fact } from "../agent/fact.ts";
import { type Sensor, createKernel } from "../kernel/loop.ts";
import { createWorld } from "../world/state.ts";
import { loadCreatures } from "./creatures.ts";
import { loadObjects } from "./objects.ts";
import { knownPredicates, loadVocabulary, readVocabulary } from "./vocabulary.ts";

const telling =
  (predicate: string): Sensor =>
  ({ self, t }) => [
    {
      subject: self,
      predicate,
      value: t,
      confidence: 1,
      tEvent: t,
      ttl: 5,
      source: "test",
    } satisfies Fact,
  ];

function worldEvents(predicates: string[], known?: ReadonlySet<string>): unknown[] {
  const kernel = createKernel({
    seed: 1,
    scenario: "test",
    world: createWorld([]),
    rules: {},
    agents: [
      {
        id: "a",
        sensors: predicates.map(telling),
        drives: () => null,
        planner: () => null,
        skills: [],
        notes: [],
        learners: [],
      },
    ],
    ...(known ? { known } : {}),
  });
  kernel.tick();
  kernel.tick();
  expect(kernel.agents[0]?.belief.facts()).toHaveLength(predicates.length);
  return kernel.trace.events.filter((event) => event.type === "world");
}

describe("vocabulary", () => {
  const vocabulary = loadVocabulary();

  it("[S-VOCAB-1] gives every property, relation and state a one-line meaning", () => {
    const meanings = [vocabulary.properties, vocabulary.relations, vocabulary.states].flatMap(
      (section) => Object.values(section),
    );
    expect(meanings.length).toBeGreaterThan(4);
    expect(meanings.every((meaning) => meaning.trim() !== "" && !meaning.includes("\n"))).toBe(
      true,
    );
  });

  it("[S-VOCAB-1] lists every property an object file uses", () => {
    const used = loadObjects().flatMap((object) => Object.keys(object.props));
    expect(used.filter((name) => !Object.hasOwn(vocabulary.properties, name))).toEqual([]);
  });

  it("[S-VOCAB-1] lists every state a creature file gives a rate", () => {
    const used = loadCreatures().flatMap((creature) => Object.keys(creature.rates));
    expect(used.filter((name) => !Object.hasOwn(vocabulary.states, name))).toEqual([]);
  });

  it("[S-VOCAB-1] knows a predicate from any of its three sections", () => {
    const known = knownPredicates(
      readVocabulary({ properties: { a: "x" }, relations: { b: "y" }, states: { c: "z" } }),
    );
    expect([...known].sort()).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["something that isn't an object", []],
    ["a missing section", { properties: {}, relations: {} }],
    ["a section it doesn't know", { properties: {}, relations: {}, states: {}, moods: {} }],
    ["a meaning that isn't text", { properties: { a: 1 }, relations: {}, states: {} }],
    ["a meaning of several lines", { properties: { a: "one\ntwo" }, relations: {}, states: {} }],
    ["an empty meaning", { properties: {}, relations: { b: " " }, states: {} }],
  ])("[S-VOCAB-1] refuses %s", (_what, value) => {
    expect(() => readVocabulary(value)).toThrow("vocabulary");
  });
});

describe("a predicate missing from the vocabulary", () => {
  const known = new Set(["hunger"]);

  it("[S-VOCAB-1] is still believed, and is reported once per run in the trace", () => {
    expect(worldEvents(["hunger", "mood"], known)).toEqual([
      { t: 1, agent: null, type: "world", data: { unknown_predicate: "mood" } },
    ]);
  });

  it("[S-VOCAB-1] is reported once each when there are several", () => {
    const reported = worldEvents(["mood", "itch"], known).map(
      (event) => (event as { data: unknown }).data,
    );
    expect(reported).toEqual([{ unknown_predicate: "mood" }, { unknown_predicate: "itch" }]);
  });

  it("[S-VOCAB-1] is not looked for when the run was given no vocabulary", () => {
    expect(worldEvents(["mood"])).toEqual([]);
  });
});
