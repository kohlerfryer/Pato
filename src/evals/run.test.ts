import { describe, expect, it } from "vitest";

import { loadContent } from "../content/content.ts";
import { type Scenario, loadScenarios } from "../content/scenarios.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { createRun, runScenario } from "./run.ts";
import { parseTrace, select } from "./trace.ts";

const content = loadContent();
const pond: Scenario = {
  id: "pond",
  horizon_s: 4,
  seeds: [3, 9],
  respawn_s: 2,
  setup: {
    objects: [
      { kind: "food", at: [4, 0] },
      { kind: "nest", at: [0, 5] },
      { kind: "food", at: [-4, 0] },
    ],
    agents: [{ creature: "duck", at: [1, 1], state: { hunger: 0.5 } }],
  },
  triggers: [{ at_s: 2, spawn: { kind: "food", at: [0, -3] } }],
};
const ids = (scenario: Scenario, ticks = 0): string[] => {
  const { kernel } = createRun(scenario, content, 1);
  for (let i = 0; i < ticks; i++) kernel.tick();
  return kernel.world.entities.map((entity) => entity.id);
};

describe("createRun", () => {
  it("[S-EVAL-1] sets up the world the scenario describes", () => {
    const { kernel } = createRun(pond, content, 1);
    expect(kernel.world.entities).toEqual([
      {
        id: "food-1",
        position: { x: 4, y: 0 },
        level: 0,
        props: { kind: "food", edible: 0.6, width: 0.5, depth: 0.5 },
      },
      {
        id: "nest-1",
        position: { x: 0, y: 5 },
        level: 0,
        props: { kind: "nest", soft: 0.1, width: 1.5, depth: 1.5 },
      },
      {
        id: "food-2",
        position: { x: -4, y: 0 },
        level: 0,
        props: { kind: "food", edible: 0.6, width: 0.5, depth: 0.5 },
      },
      {
        id: "duck-1",
        position: { x: 1, y: 1 },
        level: 0,
        props: {
          kind: "duck",
          speed: 2,
          reach: 1,
          sight: 12,
          hunger: 0.5,
          hunger_rate: 0.004,
          sleepiness_rate: 0.003,
        },
      },
    ]);
    expect(kernel.world.respawn).toBe(2 * TICKS_PER_SECOND);
  });

  it("[S-EVAL-1] gives each agent its creature's instincts, senses and drives", () => {
    const { kernel } = createRun(pond, content, 1);
    kernel.tick();
    const [duck] = kernel.agents;
    expect(duck?.id).toBe("duck-1");
    expect(duck?.registry.list().map((skill) => skill.id)).toEqual(["eat", "rest"]);
    expect(duck?.belief.get({ subject: "duck-1", predicate: "hunger" })).toBeDefined();
    expect(duck?.belief.get({ subject: "food-1", predicate: "edible" })?.value).toBe(true);
    expect(select(parseTrace(kernel.trace.text()), "goal")).toHaveLength(1);
  });

  it("[S-EVAL-1] fires a timed trigger at its time, and logs it", () => {
    const due = 2 * TICKS_PER_SECOND;
    expect(ids(pond, due - 1)).not.toContain("food-3");
    expect(ids(pond, due)).toContain("food-3");
    const { kernel } = createRun(pond, content, 1);
    for (let i = 0; i < due; i++) kernel.tick();
    expect(kernel.trace.events.filter((event) => event.type === "world")).toEqual([
      { t: due, agent: null, type: "world", data: { arrived: ["food-3"] } },
    ]);
  });

  it("[S-EVAL-1] runs for the scenario's horizon", () => {
    expect(createRun(pond, content, 1).ticks).toBe(4 * TICKS_PER_SECOND);
  });

  it.each([
    [
      "an object",
      { ...pond, setup: { ...pond.setup, objects: [{ kind: "ghost", at: [0, 0] as const }] } },
    ],
    [
      "a creature",
      {
        ...pond,
        setup: { ...pond.setup, agents: [{ creature: "ghost", at: [0, 0] as const, state: {} }] },
      },
    ],
    [
      "a spawned object",
      { ...pond, triggers: [{ at_s: 1, spawn: { kind: "ghost", at: [0, 0] as const } }] },
    ],
  ])("[S-EVAL-1] refuses a scenario that names %s there is no file for", (_what, scenario) => {
    expect(() => createRun(scenario, content, 1)).toThrow("ghost");
  });
});

describe("runScenario", () => {
  it("[S-EVAL-1] returns one trace per seed, each run to the horizon", () => {
    const traces = runScenario(pond, content);
    expect(traces.map((trace) => parseTrace(trace.text()).header)).toEqual([
      { schema: 1, seed: 3, scenario: "pond" },
      { schema: 1, seed: 9, scenario: "pond" },
    ]);
    expect(traces[0]?.events.at(-1)?.t).toBe(4 * TICKS_PER_SECOND);
  });

  it("[S-VOCAB-1] uses no predicate the vocabulary lacks, in any scenario", () => {
    for (const scenario of loadScenarios()) {
      const { kernel } = createRun(scenario, content, 1);
      for (let i = 0; i < 20 * TICKS_PER_SECOND; i++) kernel.tick();
      expect(kernel.trace.events.filter((event) => event.type === "world")).toEqual([]);
    }
  });

  it("[S-PLAN-4] has the duck act on its needs: within twenty seconds it has eaten", () => {
    const [scenario] = loadScenarios();
    if (!scenario) throw new Error("no scenario");
    const { kernel } = createRun(scenario, content, 1);
    for (let i = 0; i < 20 * TICKS_PER_SECOND; i++) kernel.tick();
    const done = kernel.trace.events.filter(
      (event) => event.type === "skill" && event.data.phase === "done",
    );
    expect(done.length).toBeGreaterThan(0);
  });
});
