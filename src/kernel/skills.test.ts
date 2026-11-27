import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import type { Skill } from "../agent/skill.ts";
import { type Entity, createWorld } from "../world/state.ts";
import type { ActionRule } from "../world/step.ts";
import { type AgentSetup, type Kernel, type Sensor, createKernel } from "./loop.ts";

const up: Condition = { subject: "$self", predicate: "level", op: "above", value: 0 };
const down: Condition = { subject: "$self", predicate: "level", op: "below", value: 0 };
const duck: Entity = { id: "a", position: { x: 0, y: 0 }, level: 0, props: {} };

const lift: ActionRule = (state, actor) => ({
  state: {
    ...state,
    entities: state.entities.map((entity) =>
      entity.id === actor ? { ...entity, level: entity.level + 1 } : entity,
    ),
  },
  outcome: { status: "done" },
});
const stay: ActionRule = (state) => ({ state, outcome: { status: "done" } });

const feel: Sensor = ({ t, world, self }) => [
  {
    subject: self,
    predicate: "level",
    value: world.entities[0]?.level ?? 0,
    confidence: 1,
    tEvent: t,
    ttl: 2,
    source: "body",
  },
];

const hop = (jumps: number): Skill => ({
  id: "hop",
  params: {},
  pre: [],
  effects: [up],
  body: Array.from({ length: jumps }, () => ({ kind: "jump" as const })),
  origin: "instinct",
});

function running(over: Partial<AgentSetup>, jump: ActionRule, ticks: number): Kernel {
  const kernel = createKernel({
    seed: 1,
    scenario: "test",
    world: createWorld([duck]),
    rules: { jump },
    agents: [
      {
        id: "a",
        sensors: [feel],
        drives: () => up,
        urgencies: () => new Map(),
        planner: () => ({ skill: "hop", args: {} }),
        skills: [hop(1)],
        notes: [],
        learners: [],
        ...over,
      },
    ],
  });
  for (let i = 0; i < ticks; i++) kernel.tick();
  return kernel;
}

const skillEvents = (kernel: Kernel): unknown[] =>
  kernel.trace.events
    .filter((event) => event.type === "skill")
    .map(({ t, data }) => ({ t, ...data }));

describe("a skill in the loop", () => {
  it("[S-EXEC-3] ends done when its declared effects hold in belief after its last action", () => {
    expect(skillEvents(running({ drives: (_belief, t) => (t < 2 ? up : null) }, lift, 2))).toEqual([
      { t: 1, phase: "start", skill: "hop", args: {} },
      { t: 2, phase: "done", skill: "hop" },
    ]);
  });

  it("[S-EXEC-3] ends failed, naming the unmet effect, when they don't", () => {
    expect(skillEvents(running({}, stay, 2))[1]).toEqual({
      t: 2,
      phase: "failed",
      skill: "hop",
      reason: "effect_unmet",
      effect: up,
    });
  });

  it("[S-EXEC-2] is interrupted at its next action boundary when the goal changes", () => {
    const asked: Condition[] = [];
    const kernel = running(
      {
        skills: [hop(3)],
        drives: (_belief, t) => (t < 3 ? up : down),
        planner: ({ goal }) => {
          asked.push(goal);
          return goal === up ? { skill: "hop", args: {} } : null;
        },
      },
      stay,
      5,
    );
    expect(skillEvents(kernel)).toEqual([
      { t: 1, phase: "start", skill: "hop", args: {} },
      { t: 3, phase: "interrupted", skill: "hop", reason: "new_goal" },
    ]);
    expect(asked).toEqual([up, down, down]);
  });

  it("[S-EXEC-2] carries on undisturbed while the goal stays the same", () => {
    const kernel = running(
      { skills: [hop(3)], drives: (_belief, t) => (t < 9 ? up : null) },
      lift,
      4,
    );
    expect(skillEvents(kernel).at(-1)).toEqual({ t: 4, phase: "done", skill: "hop" });
  });
});
