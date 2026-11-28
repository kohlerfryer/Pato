import { describe, expect, it } from "vitest";

import type { Condition } from "../agent/condition.ts";
import { CURIOSITY } from "../agent/drives.ts";
import type { Fact } from "../agent/fact.ts";
import { NOTHING } from "../agent/notes.ts";
import type { Skill } from "../agent/skill.ts";
import type { Note, PlanInput } from "./planner.ts";
import { createStubPlanner } from "./stub.ts";

const seen = (subject: string, predicate: string, source = "sight"): Fact => ({
  subject,
  predicate,
  value: true,
  confidence: 1,
  tEvent: 0,
  ttl: 100,
  source,
});
const tryer = (id: string, kind: "use" | "grab" | "jump" | "move_to"): Skill => ({
  id,
  params: { thing: { has: [] } },
  pre: [],
  effects: [],
  body:
    kind === "jump"
      ? [{ kind: "move_to", target: "$thing" }, { kind }]
      : [
          { kind: "move_to", target: "$thing" },
          ...(kind === "move_to" ? [] : [{ kind, target: "$thing" }]),
        ],
  origin: "instinct",
});
const tryers = [
  tryer("poke", "use"),
  tryer("lift", "grab"),
  tryer("hop", "jump"),
  tryer("visit", "move_to"),
];
const note = (action: Note["action"], property: string, effect: Condition = NOTHING): Note => ({
  action,
  property,
  effect,
  tries: 1,
  score: 1,
});
const curious: Condition = { subject: "$self", predicate: CURIOSITY, op: "below", value: 0.2 };
const plan = (over: Partial<PlanInput>) =>
  createStubPlanner("me")({ goal: curious, beliefs: [], skills: tryers, notes: [], ...over });

describe("exploring", () => {
  it("[S-PLAN-5] tries an action it has no note for on a property in view, and guesses what will happen", () => {
    const choice = plan({ beliefs: [seen("b", "soft")] });
    expect(choice).toMatchObject({ skill: "poke", args: { thing: "b" } });
    expect(choice?.guess).toMatch(/use.*soft/);
  });

  it("[S-PLAN-5] goes through actions, properties and things in a fixed order", () => {
    const beliefs = [seen("c", "soft"), seen("b", "soft"), seen("b", "edible")];
    const tried = ["use", "grab", "jump", "move_to"].map((action) =>
      note(action as Note["action"], "edible"),
    );
    expect(plan({ beliefs })).toMatchObject({ skill: "poke", args: { thing: "b" } });
    expect(plan({ beliefs, notes: tried.slice(0, 1) })).toMatchObject({
      skill: "lift",
      args: { thing: "b" },
    });
    expect(plan({ beliefs, notes: tried })).toMatchObject({ skill: "poke", args: { thing: "b" } });
    expect(plan({ beliefs, notes: [...tried, note("use", "soft")] })?.skill).toBe("lift");
  });

  it("[S-PLAN-5] guesses from what the same action did to other things", () => {
    const fed: Condition = { subject: "$self", predicate: "hunger", op: "below", value: 0.01 };
    const choice = plan({ beliefs: [seen("b", "soft")], notes: [note("use", "edible", fed)] });
    expect(choice?.guess).toMatch(/hunger below 0.01/);
  });

  it("[S-PLAN-5] leaves alone what it only remembers, and itself", () => {
    expect(plan({ beliefs: [seen("b", "soft", "memory")] })).toBeNull();
    expect(plan({ beliefs: [seen("me", "soft")] })).toBeNull();
  });

  it("[S-PLAN-5] has nothing to try once every action has a note, or with no skill for an action", () => {
    const all = ["use", "grab", "jump", "move_to"].map((action) =>
      note(action as Note["action"], "soft"),
    );
    expect(plan({ beliefs: [seen("b", "soft")], notes: all })).toBeNull();
    expect(plan({ beliefs: [seen("b", "soft")], skills: [] })).toBeNull();
  });
});

describe("planning through notes", () => {
  const covered: Condition = { subject: "$self", predicate: "under_cover", op: "is", value: true };
  const dry: Condition = { subject: "$self", predicate: "wet", op: "is", value: false };
  const roofNote = note("move_to", "roof", covered);

  it("[S-PLAN-6] takes a note whose effect meets the goal as a way to meet it", () => {
    const choice = plan({ goal: covered, beliefs: [seen("h", "roof")], notes: [roofNote] });
    expect(choice).toEqual({ skill: "visit", args: { thing: "h" } });
  });

  it("[S-PLAN-6] chains through a note to meet a skill's precondition", () => {
    const shelter: Skill = {
      ...tryer("wait_dry", "use"),
      id: "wait_dry",
      params: {},
      pre: [covered],
      effects: [dry],
      body: [],
    };
    const choice = plan({
      goal: dry,
      beliefs: [seen("h", "roof")],
      skills: [...tryers, shelter],
      notes: [roofNote],
    });
    expect(choice).toEqual({ skill: "visit", args: { thing: "h" } });
  });

  it("[S-MEM-2] uses a note on any thing with its property, not just the one it was learned on", () => {
    const choice = plan({ goal: covered, beliefs: [seen("other", "roof")], notes: [roofNote] });
    expect(choice?.args).toEqual({ thing: "other" });
  });

  it("[S-PLAN-6] fills in the thing a noted relation is about", () => {
    const inside: Condition = {
      subject: "$self",
      predicate: "inside",
      object: "$thing",
      op: "is",
      value: true,
    };
    const goal = { ...inside, object: "h" };
    const choice = plan({
      goal,
      beliefs: [seen("h", "has_opening")],
      notes: [note("move_to", "has_opening", inside)],
    });
    expect(choice).toEqual({ skill: "visit", args: { thing: "h" } });
  });

  it("[S-PLAN-6] prefers a skill to a note, and never plans on a note that nothing happened", () => {
    const shelter: Skill = {
      ...tryer("go_in", "move_to"),
      id: "go_in",
      params: {},
      effects: [covered],
      body: [],
    };
    expect(
      plan({
        goal: covered,
        beliefs: [seen("h", "roof")],
        skills: [...tryers, shelter],
        notes: [roofNote],
      })?.skill,
    ).toBe("go_in");
    const idle = { ...note("move_to", "roof"), effect: { ...NOTHING } };
    expect(plan({ goal: NOTHING, beliefs: [seen("h", "roof")], notes: [idle] })).toBeNull();
  });
});
