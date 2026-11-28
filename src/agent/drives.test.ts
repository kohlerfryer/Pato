import { describe, expect, it } from "vitest";

import { type Belief, createBelief } from "./belief.ts";
import { holds } from "./condition.ts";
import { createArbiter, curiosityDrive, dislikeDrive, needDrive, urgencies } from "./drives.ts";
import { record } from "./notes.ts";
import type { Note } from "../planner/planner.ts";

function feeling(levels: Record<string, number | boolean>): Belief {
  const belief = createBelief();
  for (const [predicate, value] of Object.entries(levels))
    belief.add({
      subject: "me",
      predicate,
      value,
      confidence: 1,
      tEvent: 0,
      ttl: 10,
      source: "body",
    });
  return belief;
}

const drives = [needDrive("hunger"), needDrive("sleepiness")];
const weights = { hunger: 1, sleepiness: 0.5 };
const arbiter = (): ReturnType<typeof createArbiter> => createArbiter(drives, weights, "me");
const wanted = (goal: ReturnType<ReturnType<typeof createArbiter>>): string | undefined =>
  goal?.predicate;

describe("urgencies", () => {
  it("[S-DRIVE-1] is each drive's discomfort times the creature's weight for it", () => {
    const urgency = urgencies(drives, weights, feeling({ hunger: 0.6, sleepiness: 0.8 }), "me");
    expect(urgency.get("hunger")).toBeCloseTo(0.6, 10);
    expect(urgency.get("sleepiness")).toBeCloseTo(0.4, 10);
  });

  it("[S-DRIVE-1] keeps discomfort between 0 and 1 whatever is believed", () => {
    const urgency = urgencies(drives, weights, feeling({ hunger: 7, sleepiness: -3 }), "me");
    expect([urgency.get("hunger"), urgency.get("sleepiness")]).toEqual([1, 0]);
  });

  it("[S-DRIVE-1] is zero for a drive the creature gives no weight, or knows nothing about", () => {
    const urgency = urgencies(drives, { hunger: 1 }, feeling({ sleepiness: 0.9 }), "me");
    expect([urgency.get("hunger"), urgency.get("sleepiness")]).toEqual([0, 0]);
  });
});

describe("arbiter", () => {
  it("[S-DRIVE-2] lets the most urgent drive set the goal", () => {
    expect(wanted(arbiter()(feeling({ hunger: 0.6, sleepiness: 0.8 }), 1))).toBe("hunger");
    expect(wanted(arbiter()(feeling({ hunger: 0.3, sleepiness: 0.9 }), 1))).toBe("sleepiness");
  });

  it("[S-DRIVE-2] keeps the current drive until another exceeds it by the margin", () => {
    const decide = arbiter();
    decide(feeling({ hunger: 0.5, sleepiness: 0.3 }), 1);
    expect(wanted(decide(feeling({ hunger: 0.5, sleepiness: 1 }), 2))).toBe("hunger");
    expect(wanted(decide(feeling({ hunger: 0.35, sleepiness: 1 }), 3))).toBe("sleepiness");
  });

  it("[S-DRIVE-2] then keeps the new drive by the same rule", () => {
    const decide = arbiter();
    decide(feeling({ hunger: 0.3, sleepiness: 1 }), 1);
    expect(wanted(decide(feeling({ hunger: 0.55, sleepiness: 1 }), 2))).toBe("sleepiness");
    expect(wanted(decide(feeling({ hunger: 0.65, sleepiness: 1 }), 3))).toBe("hunger");
  });

  it("[S-DRIVE-3] gives a goal that is a condition over belief, met when belief satisfies it", () => {
    const goal = arbiter()(feeling({ hunger: 0.6, sleepiness: 0 }), 1);
    expect(goal).toEqual({ subject: "$self", predicate: "hunger", op: "below", value: 0.2 });
    expect(goal && holds(goal, feeling({ hunger: 0.6 }), { self: "me" })).toBe(false);
    expect(goal && holds(goal, feeling({ hunger: 0.1 }), { self: "me" })).toBe(true);
  });

  it("[S-DRIVE-3] moves on to the next drive once the current goal is met", () => {
    const decide = arbiter();
    decide(feeling({ hunger: 0.9, sleepiness: 0.5 }), 1);
    expect(wanted(decide(feeling({ hunger: 0.1, sleepiness: 0.5 }), 2))).toBe("sleepiness");
  });

  it("[S-DRIVE-3] wants nothing when every goal is met", () => {
    expect(arbiter()(feeling({ hunger: 0.1, sleepiness: 0.15 }), 1)).toBeNull();
  });

  it("[S-DRIVE-2] never lets a drive with no weight set the goal", () => {
    const decide = createArbiter(drives, { hunger: 1 }, "me");
    expect(decide(feeling({ hunger: 0.1, sleepiness: 0.9 }), 1)).toBeNull();
  });

  it("[S-DRIVE-2] breaks an exact tie by drive name", () => {
    const decide = createArbiter(drives, { hunger: 1, sleepiness: 1 }, "me");
    expect(wanted(decide(feeling({ hunger: 0.5, sleepiness: 0.5 }), 1))).toBe("hunger");
  });
});

describe("dislikes", () => {
  const wet = dislikeDrive("wet");

  it("[S-DRIVE-5] is fully uncomfortable while the agent believes it is wet, and not at all otherwise", () => {
    expect(wet.discomfort(feeling({ wet: true }), "me")).toBe(1);
    expect(wet.discomfort(feeling({ wet: false }), "me")).toBe(0);
    expect(wet.discomfort(feeling({}), "me")).toBe(0);
  });

  it("[S-DRIVE-5] wants the disliked state to be false", () => {
    expect(wet.goal).toEqual({ subject: "$self", predicate: "wet", op: "is", value: false });
    expect(holds(wet.goal, feeling({ wet: false }), { self: "me" })).toBe(true);
  });

  it("[S-DRIVE-5] sets the goal when being wet matters more than being hungry", () => {
    const choose = createArbiter([needDrive("hunger"), wet], { hunger: 1, wet: 0.9 }, "me");
    expect(choose(feeling({ hunger: 0.4, wet: true }), 1)?.predicate).toBe("wet");
  });
});

describe("curiosity", () => {
  function seeing(things: Record<string, string[]>, source = "sight"): Belief {
    const belief = createBelief();
    for (const [subject, properties] of Object.entries(things))
      for (const predicate of properties)
        belief.add({ subject, predicate, value: true, confidence: 1, tEvent: 0, ttl: 10, source });
    return belief;
  }
  const tries = (property: string, n: number, action: Note["action"] = "use"): Note[] => {
    let notes: Note[] = [];
    for (let i = 0; i < n; i++) notes = record(notes, { action, property, effects: [] }, 0.5);
    return notes;
  };
  const curious = (notes: Note[]) => curiosityDrive(() => notes);

  it("[S-DRIVE-4] is fully curious about a thing in view whose properties it has never tried", () => {
    expect(curious([]).discomfort(seeing({ b: ["edible"] }), "me")).toBe(1);
  });

  it("[S-DRIVE-4] is 1 / sqrt(1 + n), where n counts the tries on the thing's visible properties", () => {
    const notes = [...tries("edible", 2), ...tries("soft", 1, "grab")];
    expect(curious(notes).discomfort(seeing({ b: ["edible", "soft"] }), "me")).toBeCloseTo(0.5, 9);
  });

  it("[S-DRIVE-4] takes the most curious of the things in view", () => {
    const notes = tries("edible", 8);
    const belief = seeing({ b: ["edible"], c: ["soft"] });
    expect(curious(notes).discomfort(belief, "me")).toBe(1);
    expect(curious([...notes, ...tries("soft", 3)]).discomfort(belief, "me")).toBeCloseTo(0.5, 9);
  });

  it("[S-DRIVE-4] is not curious about nothing, about itself, or about what it only remembers", () => {
    expect(curious([]).discomfort(createBelief(), "me")).toBe(0);
    expect(curious([]).discomfort(seeing({ me: ["edible"] }), "me")).toBe(0);
    expect(curious([]).discomfort(seeing({ b: ["edible"] }, "memory"), "me")).toBe(0);
  });

  it("[S-DRIVE-4] stops wanting once curiosity falls below where a need counts as met", () => {
    const belief = seeing({ b: ["edible"] });
    const choose = (n: number) =>
      createArbiter([curious(tries("edible", n))], { curiosity: 1 }, "me");
    expect(choose(24)(belief, 1)?.predicate).toBe("curiosity");
    expect(choose(25)(belief, 1)).toBeNull();
  });

  it("[S-DRIVE-4] reads the notes as they are now, not as they were when it was made", () => {
    const notes: Note[] = [];
    const drive = curiosityDrive(() => notes);
    notes.push(...tries("edible", 3));
    expect(drive.discomfort(seeing({ b: ["edible"] }), "me")).toBeCloseTo(0.5, 9);
  });
});
