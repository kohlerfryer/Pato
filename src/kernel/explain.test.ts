import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import type { Fact } from "../agent/fact.ts";
import type { Note } from "../planner/planner.ts";
import { createWorld } from "../world/state.ts";
import { type AgentSetup, type Kernel, type Sensor, createKernel } from "./loop.ts";

const up: Condition = { subject: "$self", predicate: "level", op: "above", value: 0 };
const down: Condition = { subject: "$self", predicate: "level", op: "below", value: 1 };

const snack = (t: number): Fact => ({
  subject: "b",
  predicate: "edible",
  value: true,
  confidence: 1,
  tEvent: t,
  ttl: 3,
  source: "test",
});

function ran(over: Partial<AgentSetup>, ticks: number): Kernel {
  const agent: AgentSetup = {
    id: "a",
    sensors: [],
    drives: () => null,
    urgencies: () => new Map(),
    planner: () => null,
    skills: [],
    notes: [],
    learners: [],
    ...over,
  };
  const kernel = createKernel({
    seed: 1,
    scenario: "test",
    world: createWorld([]),
    rules: {},
    agents: [agent],
  });
  for (let i = 0; i < ticks; i++) kernel.tick();
  return kernel;
}
const logged = (kernel: Kernel, type: string): unknown[] =>
  kernel.trace.events.filter((event) => event.type === type).map(({ t, data }) => ({ t, ...data }));

describe("why a goal was chosen", () => {
  const urgencies = (): Map<string, number> =>
    new Map([
      ["climb", 0.6],
      ["rest", 0.2],
    ]);

  it("[S-TRACE-4] records the urgency of every drive on the tick the goal changes", () => {
    const kernel = ran({ drives: (_belief, t) => (t < 3 ? up : down), urgencies }, 5);
    expect(logged(kernel, "drive")).toEqual([
      { t: 1, urgencies: { climb: 0.6, rest: 0.2 } },
      { t: 3, urgencies: { climb: 0.6, rest: 0.2 } },
    ]);
  });

  it("[S-TRACE-4] records the urgencies just before the goal they led to", () => {
    const kernel = ran({ drives: () => up, urgencies }, 1);
    expect(kernel.trace.events.map((event) => event.type)).toEqual(["drive", "goal"]);
  });

  it("[S-TRACE-4] records them when the agent stops wanting anything, too", () => {
    const kernel = ran({ drives: (_belief, t) => (t < 2 ? up : null), urgencies }, 3);
    expect(logged(kernel, "drive").map((event) => (event as { t: number }).t)).toEqual([1, 2]);
  });

  it("[S-TRACE-4] reads the urgencies from what the agent believes", () => {
    const feel: Sensor = ({ self, t }) => [
      { ...snack(t), subject: self, predicate: "ache", value: 0.4 },
    ];
    const kernel = ran(
      {
        sensors: [feel],
        drives: () => up,
        urgencies: (belief) =>
          new Map([["ache", Number(belief.get({ subject: "a", predicate: "ache" })?.value)]]),
      },
      1,
    );
    expect(logged(kernel, "drive")).toEqual([{ t: 1, urgencies: { ache: 0.4 } }]);
  });
});

describe("forgetting", () => {
  const once: Sensor = ({ t }) => (t === 1 ? [snack(t)] : []);
  const twice: Sensor = ({ t }) => (t === 1 || t === 7 ? [snack(t)] : []);

  it("[S-TRACE-5] records a fact as forgotten on the tick it leaves belief", () => {
    expect(logged(ran({ sensors: [once] }, 8), "fact")).toEqual([
      { t: 1, subject: "b", predicate: "edible", value: true, confidence: 1, source: "test" },
      { t: 5, subject: "b", predicate: "edible", forgotten: true },
    ]);
  });

  it("[S-TRACE-5] says what a forgotten fact was about when it had an object", () => {
    const near: Sensor = ({ t }) =>
      t === 1 ? [{ ...snack(t), subject: "a", predicate: "near", object: "b" }] : [];
    expect(logged(ran({ sensors: [near] }, 5), "fact")[1]).toEqual({
      t: 5,
      subject: "a",
      predicate: "near",
      object: "b",
      forgotten: true,
    });
  });

  it("[S-TRACE-5] records a forgotten fact again when it is learned again", () => {
    const facts = logged(ran({ sensors: [twice] }, 8), "fact") as { t: number; value?: boolean }[];
    expect(facts.map(({ t, value }) => [t, value])).toEqual([
      [1, true],
      [5, undefined],
      [7, true],
    ]);
  });

  it("[S-TRACE-5] records nothing while a fact is kept fresh", () => {
    const always: Sensor = ({ t }) => [snack(t)];
    expect(logged(ran({ sensors: [always] }, 20), "fact")).toHaveLength(1);
  });
});

describe("what the planner is shown of memory", () => {
  it("[S-MEM-4] is at most 8 notes, those bearing on the goal first", () => {
    const shown: number[] = [];
    const filler = Array.from({ length: 10 }, (_, i) => ({
      action: "use" as const,
      property: `p${String(i)}`,
      effect: { subject: "$self", predicate: "other", op: "is" as const, value: true },
      tries: 1,
      score: 1,
    }));
    const climbing = { action: "use" as const, property: "q", effect: up, tries: 1, score: 1 };
    const kernel = ran(
      {
        drives: () => up,
        notes: [...filler, climbing],
        planner: ({ notes }) => {
          shown.push(notes.length);
          expect(notes[0]).toEqual(climbing);
          return null;
        },
      },
      1,
    );
    expect(kernel.agents[0]?.memory.notes).toHaveLength(11);
    expect(shown).toEqual([8]);
  });
});

describe("what an agent learns", () => {
  it("[S-TRACE-2] logs each note a learner adds or changes, as a learn event", () => {
    const notes: Note[] = [];
    const first: Note = { action: "use", property: "soft", effect: up, tries: 1, score: 1 };
    let tick = 0;
    const learner = (): void => {
      tick += 1;
      if (tick === 2) notes.push(first);
      if (tick === 3) notes.splice(0, 1, { ...first, tries: 2 });
    };
    const kernel = ran({ notes, learners: [learner], drives: () => up, planner: () => null }, 4);
    expect(logged(kernel, "learn")).toEqual([
      { t: 2, note: first },
      { t: 3, note: { ...first, tries: 2 } },
    ]);
  });
});
