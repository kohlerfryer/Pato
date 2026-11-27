import { describe, expect, it } from "vitest";

import { type Belief, createBelief } from "./belief.ts";
import { choiceProblem } from "./choice.ts";
import { type Condition, holds } from "./condition.ts";
import type { Fact } from "./fact.ts";
import { type Registry, createRegistry } from "./registry.ts";
import type { Skill } from "./skill.ts";

const eat: Skill = {
  id: "eat",
  params: { food: { has: ["edible"] } },
  pre: [{ subject: "$self", predicate: "near", object: "$food", op: "is", value: true }],
  effects: [{ subject: "$self", predicate: "hunger", op: "below", value: 0.2 }],
  body: [{ kind: "use", target: "$food" }],
  origin: "instinct",
};

const fact = (subject: string, predicate: string, value: Fact["value"], object?: string): Fact => ({
  subject,
  predicate,
  value,
  confidence: 1,
  tEvent: 0,
  ttl: 100,
  source: "sight",
  ...(object === undefined ? {} : { object }),
});

function believing(...facts: Fact[]): Belief {
  const belief = createBelief();
  for (const each of facts) belief.add(each);
  return belief;
}

function knowing(...skills: Skill[]): Registry {
  const registry = createRegistry();
  for (const skill of skills) registry.register(skill);
  return registry;
}

const scene = (): Belief =>
  believing(
    fact("me", "hunger", 0.7),
    fact("thing-1", "edible", true),
    fact("thing-2", "soft", true),
    fact("me", "near", true, "thing-1"),
  );

const problem = (skill: string, args: Record<string, string>, belief = scene()): string | null =>
  choiceProblem({ skill, args }, { registry: knowing(eat), belief, self: "me" });

describe("choiceProblem", () => {
  it("[S-PLAN-2] lets a registered skill run on a matching entity when its preconditions hold", () => {
    expect(problem("eat", { food: "thing-1" })).toBeNull();
  });

  it("[S-PLAN-2] stops a skill that isn't registered", () => {
    expect(problem("fly", {})).toContain("fly");
  });

  it("[S-PLAN-2] stops a choice that leaves a parameter empty", () => {
    expect(problem("eat", {})).toContain("food");
  });

  it("[S-PLAN-2] stops an argument naming something the agent doesn't believe in", () => {
    expect(problem("eat", { food: "ghost" })).toContain("ghost");
  });

  it("[S-PLAN-2] stops an argument that lacks the properties the parameter asks for", () => {
    expect(problem("eat", { food: "thing-2" })).toContain("thing-2");
  });

  it("[S-PLAN-2] stops an argument the skill has no parameter for", () => {
    expect(problem("eat", { food: "thing-1", extra: "thing-2" })).toContain("extra");
  });

  it("[S-PLAN-2] stops a skill whose preconditions don't hold in belief", () => {
    const far = believing(fact("me", "hunger", 0.7), fact("thing-1", "edible", true));
    expect(problem("eat", { food: "thing-1" }, far)).toContain("near");
  });
});

describe("holds", () => {
  const belief = scene();
  const names = { self: "me", food: "thing-1" };
  const about = (over: Partial<Condition>): Condition => ({
    subject: "$self",
    predicate: "hunger",
    op: "is",
    value: 0.7,
    ...over,
  });

  it("[S-PLAN-2] compares a believed value with is, below and above", () => {
    expect(holds(about({}), belief, names)).toBe(true);
    expect(holds(about({ op: "below", value: 0.8 }), belief, names)).toBe(true);
    expect(holds(about({ op: "below", value: 0.7 }), belief, names)).toBe(false);
    expect(holds(about({ op: "above", value: 0.5 }), belief, names)).toBe(true);
    expect(holds(about({ op: "above", value: 0.7 }), belief, names)).toBe(false);
  });

  it("[S-PLAN-2] fills in names on both sides of a relation", () => {
    const near = about({ predicate: "near", object: "$food", value: true });
    expect(holds(near, belief, names)).toBe(true);
    expect(holds(near, belief, { self: "me", food: "thing-2" })).toBe(false);
  });

  it("[S-PLAN-2] takes a plain entity id as it stands", () => {
    expect(holds(about({ subject: "me" }), belief, {})).toBe(true);
  });

  it("[S-PLAN-2] doesn't hold when nothing is believed about it", () => {
    expect(holds(about({ predicate: "wet", value: false }), belief, names)).toBe(false);
  });

  it("[S-PLAN-2] doesn't hold when a name has nothing to fill it", () => {
    expect(holds(about({}), belief, {})).toBe(false);
    expect(
      holds(about({ predicate: "near", object: "$food", value: true }), belief, { self: "me" }),
    ).toBe(false);
  });

  it("[S-PLAN-2] never orders values that aren't numbers", () => {
    const edible = about({ subject: "thing-1", predicate: "edible", op: "above", value: 0 });
    expect(holds(edible, belief, names)).toBe(false);
  });
});
