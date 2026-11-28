import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import type { Fact } from "../agent/fact.ts";
import type { Skill } from "../agent/skill.ts";
import type { Note, PlanInput, Planner } from "../planner/planner.ts";
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
const chooseHop: Planner = () => ({ skill: "hop", args: {} });
const landed: ActionRule = (state) => ({ state, outcome: { status: "done" } });

const fact = (subject: string, predicate: string, value: Fact["value"], over = {}): Fact => ({
  subject,
  predicate,
  value,
  confidence: 1,
  tEvent: 0,
  ttl: 3,
  source: "test",
  ...over,
});

const agent = (id: string, over: Partial<AgentSetup> = {}): AgentSetup => ({
  id,
  sensors: [],
  drives: () => wantUp,
  urgencies: () => new Map(),
  planner: chooseHop,
  skills: [hop],
  notes: [],
  learners: [],
  ...over,
});

const kernelWith = (agents: AgentSetup[], seed = 1): Kernel =>
  createKernel({ seed, scenario: "test", world: createWorld([]), rules: { jump: landed }, agents });

const types = (kernel: Kernel): string[] => kernel.trace.events.map((event) => event.type);

describe("tick order", () => {
  it("[S-TICK-2] runs world step, sensors, belief, drives, planner, executor, learners, then trace", () => {
    const order: string[] = [];
    const seenByLearner: number[] = [];
    const rule: ActionRule = (state) => {
      order.push("world");
      return { state, outcome: { status: "done" } };
    };
    const kernel: Kernel = createKernel({
      seed: 1,
      scenario: "test",
      world: createWorld([]),
      rules: { jump: rule },
      agents: [
        agent("a", {
          sensors: [
            ({ t, self }) => {
              order.push("sensors");
              return [fact(self, "seen", t, { tEvent: t })];
            },
          ],
          drives: (belief, t) => {
            const fresh = belief.get({ subject: "a", predicate: "seen" })?.value === t;
            order.push(fresh ? "belief" : "stale belief", "drives");
            return wantUp;
          },
          planner: () => {
            order.push("planner");
            return { skill: "hop", args: {} };
          },
          learners: [
            (events) => {
              const started = events.some((event) => event.type === "action");
              order.push(started ? "executor" : "no executor", "learners");
              seenByLearner.push(kernel.trace.events.length);
            },
          ],
        }),
      ],
    });

    kernel.tick();
    expect(order).toEqual(["sensors", "belief", "drives", "planner", "executor", "learners"]);
    expect(seenByLearner).toEqual([0]);
    expect(types(kernel)).toEqual(["fact", "drive", "goal", "plan", "skill", "action"]);

    order.length = 0;
    kernel.tick();
    expect(order.slice(0, 2)).toEqual(["world", "sensors"]);
  });

  it("[S-TICK-2] hands the world's verdict on an action to the executor one tick later", () => {
    const kernel = kernelWith([agent("a")]);
    kernel.tick();
    kernel.tick();
    const actions = kernel.trace.events.filter((event) => event.type === "action");
    expect(actions.map(({ t, data }) => [t, data.phase, data.status])).toEqual([
      [1, "start", undefined],
      [2, "end", "done"],
    ]);
  });
});

describe("planner", () => {
  it("[S-PLAN-1] is any function from goal, beliefs, skills and notes to a skill with arguments", () => {
    const inputs: PlanInput[] = [];
    const note: Note = { action: "jump", property: "flat_top", effect: wantUp, tries: 1, score: 1 };
    const sure: Sensor = ({ self, t }) => [
      fact(self, "level", 0, { tEvent: t }),
      fact(self, "wet", true, { tEvent: t, confidence: 0.3 }),
    ];
    const kernel = kernelWith([
      agent("a", {
        sensors: [sure],
        notes: [note],
        planner: (input) => {
          inputs.push(input);
          return { skill: "hop", args: {} };
        },
      }),
    ]);
    kernel.tick();
    expect(Object.keys(inputs[0] ?? {}).sort()).toEqual(["beliefs", "goal", "notes", "skills"]);
    expect(inputs[0]?.goal).toEqual(wantUp);
    expect(inputs[0]?.notes).toEqual([note]);
    expect(inputs[0]?.skills).toEqual([
      { id: "hop", params: {}, pre: [], effects: [], body: hop.body },
    ]);
    expect(inputs[0]?.skills[0]).not.toHaveProperty("origin");
    expect(types(kernel)).toContain("skill");
  });

  it("[S-FACT-4] is shown only the facts the agent is sure enough of", () => {
    const inputs: PlanInput[] = [];
    const mixed: Sensor = ({ self, t }) => [
      fact(self, "level", 0, { tEvent: t }),
      fact(self, "wet", true, { tEvent: t, confidence: 0.3 }),
    ];
    const kernel = kernelWith([
      agent("a", {
        sensors: [mixed],
        planner: (input) => {
          inputs.push(input);
          return null;
        },
      }),
    ]);
    kernel.tick();
    expect(inputs[0]?.beliefs.map((each) => each.predicate)).toEqual(["level"]);
    expect(kernel.agents[0]?.belief.facts()).toHaveLength(2);
  });

  it("[S-PLAN-1] may choose nothing, and then nothing runs", () => {
    const kernel = kernelWith([agent("a", { planner: () => null })]);
    kernel.tick();
    expect(types(kernel)).toEqual(["drive", "goal"]);
  });

  it("[S-PLAN-1] is not asked while the agent has no goal or is busy with a skill", () => {
    let asked = 0;
    const counting: Planner = () => {
      asked += 1;
      return { skill: "hop", args: {} };
    };
    const idle = kernelWith([agent("a", { drives: () => null, planner: counting })]);
    idle.tick();
    expect(asked).toBe(0);
    const busy = kernelWith([agent("a", { planner: counting })]);
    busy.tick();
    busy.tick();
    expect(asked).toBe(1);
  });

  it("[S-PLAN-2] has an invalid choice logged, and the agent idles", () => {
    const kernel = kernelWith([agent("a", { planner: () => ({ skill: "fly", args: {} }) })]);
    kernel.tick();
    const plan = kernel.trace.events.find((event) => event.type === "plan");
    expect(plan?.data).toEqual({ skill: "fly", args: {}, invalid: "no skill called fly" });
    expect(types(kernel)).toEqual(["drive", "goal", "plan"]);
  });
});

describe("agents", () => {
  it("[S-TICK-5] are stepped in id order, whatever order they were given in", () => {
    const order: string[] = [];
    const noisy = (id: string): AgentSetup =>
      agent(id, {
        sensors: [
          () => {
            order.push(`sense ${id}`);
            return [];
          },
        ],
        drives: () => {
          order.push(`drive ${id}`);
          return wantUp;
        },
        planner: () => {
          order.push(`plan ${id}`);
          return null;
        },
      });
    const kernel = kernelWith([noisy("b"), noisy("a")]);
    kernel.tick();
    expect(kernel.agents.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(order).toEqual(["sense a", "sense b", "drive a", "drive b", "plan a", "plan b"]);
  });

  it("[S-TICK-5] each have their own belief, drives, memory and registry", () => {
    const asked: Record<string, PlanInput> = {};
    const noteA: Note = {
      action: "jump",
      property: "flat_top",
      effect: wantUp,
      tries: 2,
      score: 1,
    };
    const record =
      (id: string): Planner =>
      (input) => {
        asked[id] = input;
        return null;
      };
    const other: Skill = { ...hop, id: "skip" };
    const rest: Condition = { subject: "$self", predicate: "sleepiness", op: "below", value: 0.2 };
    const kernel = kernelWith([
      agent("a", { notes: [noteA], planner: record("a") }),
      agent("b", { skills: [other], drives: () => rest, planner: record("b") }),
    ]);
    kernel.tick();
    const [a, b] = kernel.agents;
    expect(a?.belief).not.toBe(b?.belief);
    expect(a?.registry.get("hop")).toBeDefined();
    expect(b?.registry.get("hop")).toBeUndefined();
    expect(a?.memory.notes).toEqual([noteA]);
    expect(b?.memory.notes).toEqual([]);
    expect(asked.a?.goal).toEqual(wantUp);
    expect(asked.b?.goal).toEqual(rest);
    expect(asked.b?.skills.map((skill) => skill.id)).toEqual(["skip"]);
  });

  it("[S-FACT-5] believe only what their own sensors tell them", () => {
    const sees: Sensor = ({ t }) => [fact("thing", "soft", true, { tEvent: t })];
    const kernel = kernelWith([agent("a", { sensors: [sees] }), agent("b")]);
    kernel.tick();
    const [a, b] = kernel.agents;
    expect(a?.belief.get({ subject: "thing", predicate: "soft" })?.value).toBe(true);
    expect(b?.belief.facts()).toEqual([]);
  });

  it("[S-FACT-5] keep a fact about another agent in the belief of the one who sensed it", () => {
    const watches: Sensor = ({ t }) => [fact("b", "wet", true, { tEvent: t })];
    const kernel = kernelWith([agent("a", { sensors: [watches] }), agent("b")]);
    kernel.tick();
    expect(kernel.agents[1]?.belief.facts()).toEqual([]);
    expect(kernel.agents[0]?.belief.facts()).toHaveLength(1);
  });

  it("[S-FACT-3] forget what their sensors stop telling them", () => {
    const once: Sensor = ({ t }) => (t === 1 ? [fact("thing", "soft", true, { tEvent: t })] : []);
    const kernel = kernelWith([agent("a", { sensors: [once], drives: () => null })]);
    for (let i = 0; i < 4; i++) kernel.tick();
    expect(kernel.agents[0]?.belief.facts()).toHaveLength(1);
    kernel.tick();
    expect(kernel.agents[0]?.belief.facts()).toEqual([]);
  });

  it("[S-REG-2] can't be set up with a skill the registry turns away", () => {
    const bad = { ...hop, body: [{ kind: "fly" }] } as unknown as Skill;
    expect(() => kernelWith([agent("a", { skills: [bad] })])).toThrow("fly");
  });
});
