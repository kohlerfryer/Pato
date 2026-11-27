import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import type { Fact } from "../agent/fact.ts";
import type { Skill } from "../agent/skill.ts";
import { createWorld } from "../world/state.ts";
import type { ActionRule } from "../world/step.ts";
import { type AgentSetup, type Kernel, type Sensor, createKernel } from "./loop.ts";

const hop: Skill = {
  id: "hop",
  params: {},
  pre: [],
  effects: [],
  body: [{ kind: "jump" }],
  origin: "instinct",
};
const wantUp: Condition = { subject: "$self", predicate: "level", op: "above", value: 0 };
const landed: ActionRule = (state) => ({ state, outcome: { status: "done" } });

const fact = (subject: string, predicate: string, value: Fact["value"], t: number): Fact => ({
  subject,
  predicate,
  value,
  confidence: 1,
  tEvent: t,
  ttl: 3,
  source: "test",
});

const agent = (id: string, over: Partial<AgentSetup> = {}): AgentSetup => ({
  id,
  sensors: [],
  drives: () => wantUp,
  planner: () => ({ skill: "hop", args: {} }),
  skills: [hop],
  notes: [],
  learners: [],
  ...over,
});

const kernelWith = (agents: AgentSetup[], seed = 1): Kernel =>
  createKernel({ seed, scenario: "test", world: createWorld([]), rules: { jump: landed }, agents });

describe("a run", () => {
  const guess: Sensor = ({ self, t, random }) => [
    fact(self, "mood", Math.floor(random() * 1000), t),
  ];
  const run = (seed: number): string => {
    const kernel = kernelWith(
      [agent("a", { sensors: [guess] }), agent("b", { sensors: [guess] })],
      seed,
    );
    for (let i = 0; i < 20; i++) kernel.tick();
    return kernel.trace.text();
  };

  it("[S-TICK-4] gives a byte-identical trace for the same seed and setup", () => {
    expect(run(7)).toBe(run(7));
    expect(run(7).split("\n").length).toBeGreaterThan(40);
  });

  it("[S-TICK-4] gives a different trace for a different seed", () => {
    expect(run(7)).not.toBe(run(8));
  });

  it("[S-TICK-3] gives each agent's senses their own stream", () => {
    const moods = (ids: string[]): unknown[] => {
      const kernel = kernelWith(
        ids.map((id) => agent(id, { sensors: [guess], drives: () => null })),
        7,
      );
      kernel.tick();
      return kernel.agents
        .filter(({ id }) => id === "b")
        .map(({ belief }) => belief.facts()[0]?.value);
    };
    expect(moods(["a", "b"])).toEqual(moods(["b"]));
  });

  it("[S-WORLD-1] keeps the world the step function last returned", () => {
    const lift: ActionRule = (state, actor) => ({
      state: {
        ...state,
        entities: state.entities.map((entity) =>
          entity.id === actor ? { ...entity, level: entity.level + 1 } : entity,
        ),
      },
      outcome: { status: "done" },
    });
    const kernel = createKernel({
      seed: 1,
      scenario: "test",
      world: createWorld([{ id: "a", position: { x: 0, y: 0 }, level: 0, props: {} }]),
      rules: { jump: lift },
      agents: [agent("a")],
    });
    kernel.tick();
    expect(kernel.world.entities[0]?.level).toBe(0);
    kernel.tick();
    expect(kernel.world.entities[0]?.level).toBe(1);
  });
});
