import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import type { Fact } from "../agent/fact.ts";
import type { Skill } from "../agent/skill.ts";
import type { PlanInput } from "./planner.ts";
import { createStubPlanner } from "./stub.ts";

const fact = (subject: string, predicate: string, value: Fact["value"], object?: string): Fact => ({
  subject,
  predicate,
  value,
  confidence: 1,
  tEvent: 0,
  ttl: 100,
  source: "test",
  ...(object === undefined ? {} : { object }),
});
const is = (subject: string, predicate: string, object?: string): Condition => ({
  subject,
  predicate,
  op: "is",
  value: true,
  ...(object === undefined ? {} : { object }),
});
const below = (predicate: string, value: number): Condition => ({
  subject: "$self",
  predicate,
  op: "below",
  value,
});
const skill = (id: string, over: Partial<Skill>): Skill => ({
  id,
  params: {},
  pre: [],
  effects: [],
  body: [],
  origin: "instinct",
  ...over,
});

const eat = skill("eat", {
  params: { food: { has: ["edible"] } },
  pre: [is("$self", "near", "$food")],
  effects: [below("hunger", 0.2)],
});
const approach = skill("approach", {
  params: { thing: { has: [] } },
  effects: [is("$self", "near", "$thing")],
});
const scene = [
  fact("me", "hunger", 0.7),
  fact("food-2", "edible", true),
  fact("food-1", "edible", true),
  fact("rock", "heavy", true),
];
const plan = (
  goal: Condition,
  skills: Skill[],
  beliefs = scene,
): ReturnType<ReturnType<typeof createStubPlanner>> => {
  const input: PlanInput = { goal, beliefs, skills, notes: [] };
  return createStubPlanner("me")(input);
};
const hungry = below("hunger", 0.2);

describe("stub planner", () => {
  it("[S-PLAN-4] picks a skill whose effects satisfy the goal, once its preconditions hold", () => {
    const near = [...scene, fact("me", "near", true, "food-1")];
    expect(plan(hungry, [eat, approach], near)).toEqual({ skill: "eat", args: { food: "food-1" } });
  });

  it("[S-PLAN-4] chains backward to the skill that makes a precondition hold", () => {
    expect(plan(hungry, [eat, approach])).toEqual({ skill: "approach", args: { thing: "food-1" } });
  });

  it("[S-PLAN-4] aims the chained skill at the very thing the precondition is about", () => {
    const goal = is("$self", "near", "food-2");
    expect(plan(goal, [approach])).toEqual({ skill: "approach", args: { thing: "food-2" } });
  });

  it("[S-PLAN-4] fills a parameter only with something that has its properties", () => {
    const beliefs = [fact("me", "hunger", 0.7), fact("rock", "heavy", true)];
    expect(plan(hungry, [eat, approach], beliefs)).toBeNull();
  });

  it("[S-PLAN-4] prefers the thing already at hand over one it would have to reach", () => {
    const near = [...scene, fact("me", "near", true, "food-2")];
    expect(plan(hungry, [eat, approach], near)).toEqual({ skill: "eat", args: { food: "food-2" } });
  });

  it("[S-PLAN-4] breaks ties by skill id", () => {
    const gobble = skill("gobble", { effects: [below("hunger", 0.2)] });
    const chew = skill("chew", { effects: [below("hunger", 0.2)] });
    expect(plan(hungry, [gobble, chew])?.skill).toBe("chew");
  });

  it("[S-PLAN-4] takes an effect that goes further than the goal asks", () => {
    const feast = skill("feast", { effects: [below("hunger", 0.05)] });
    expect(plan(hungry, [feast])?.skill).toBe("feast");
  });

  it("[S-PLAN-4] passes over an effect that falls short of the goal, or is about something else", () => {
    const nibble = skill("nibble", { effects: [below("hunger", 0.5)] });
    const nap = skill("nap", { effects: [below("sleepiness", 0.2)] });
    const cram = skill("cram", { effects: [{ ...below("hunger", 0.2), op: "above" }] });
    expect(plan(hungry, [nibble, nap, cram])).toBeNull();
  });

  it("[S-PLAN-4] matches goals that ask for more, and for an exact value", () => {
    const climb = skill("climb", { effects: [{ ...below("level", 2), op: "above" }] });
    expect(plan({ ...below("level", 1), op: "above" }, [climb])?.skill).toBe("climb");
    expect(plan({ ...below("level", 3), op: "above" }, [climb])).toBeNull();
    const dry = skill("dry", { effects: [{ ...is("$self", "wet"), value: false }] });
    expect(plan({ ...is("$self", "wet"), value: false }, [dry])?.skill).toBe("dry");
    expect(plan(is("$self", "wet"), [dry])).toBeNull();
  });

  const chain = (length: number): Skill[] =>
    Array.from({ length }, (_, i) =>
      skill(`step-${String(i)}`, {
        effects: [is("$self", `stage-${String(i)}`)],
        pre: i + 1 < length ? [is("$self", `stage-${String(i + 1)}`)] : [],
      }),
    );

  it("[S-PLAN-4] chains through preconditions to a depth of 5", () => {
    expect(plan(is("$self", "stage-0"), chain(6))?.skill).toBe("step-5");
  });

  it("[S-PLAN-4] gives up on a chain deeper than 5", () => {
    expect(plan(is("$self", "stage-0"), chain(7))).toBeNull();
  });

  it("[S-PLAN-4] chooses nothing when no skill's effects satisfy the goal", () => {
    expect(plan(is("$self", "on_top", "rock"), [eat, approach])).toBeNull();
  });

  it("[S-PLAN-4] doesn't mistake a relation for a state of the same name", () => {
    const glow = skill("glow", { effects: [is("$self", "near")] });
    expect(plan(is("$self", "near", "rock"), [glow])).toBeNull();
  });

  it("[S-PLAN-4] won't aim a skill at something its effect names differently", () => {
    const home = skill("home", { effects: [is("$self", "near", "nest-1")] });
    expect(plan(is("$self", "near", "rock"), [home])).toBeNull();
    expect(plan(is("$self", "near", "nest-1"), [home])?.skill).toBe("home");
  });
});
