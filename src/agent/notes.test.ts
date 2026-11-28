import { describe, expect, it } from "vitest";

import type { Condition } from "./condition.ts";
import { NOTHING, type Tried, amend, record, retrieve, triesOn } from "./notes.ts";

const fed: Condition = { subject: "$self", predicate: "hunger", op: "below", value: 0.01 };
const near: Condition = {
  subject: "$self",
  predicate: "near",
  object: "$thing",
  op: "is",
  value: true,
};
const tried = (
  effects: Condition[],
  action: Tried["action"] = "use",
  property = "edible",
): Tried => ({
  action,
  property,
  effects,
});
const rate = 0.5;

describe("recording a try", () => {
  it("[S-MEM-1] makes a note of the action, the property, the effect, one try and a full score", () => {
    expect(record([], tried([fed]), rate)).toEqual([
      { action: "use", property: "edible", effect: fed, tries: 1, score: 1 },
    ]);
  });

  it("[S-MEM-1] makes one note for each effect it saw", () => {
    expect(record([], tried([fed, near]), rate).map(({ effect }) => effect)).toEqual([fed, near]);
  });

  it("[S-MEM-1] notes that nothing happened, so the try still counts", () => {
    expect(record([], tried([]), rate)).toEqual([
      { action: "use", property: "edible", effect: NOTHING, tries: 1, score: 1 },
    ]);
  });

  it("[S-MEM-3] moves a note's score toward 1 when its effect happens again, and toward 0 when it doesn't", () => {
    const once = record([], tried([fed]), rate);
    const missed = record(once, tried([]), rate);
    expect(missed[0]).toMatchObject({ effect: fed, tries: 2, score: 0.5 });
    const again = record(missed, tried([fed]), rate);
    expect(again[0]).toMatchObject({ effect: fed, tries: 3, score: 0.75 });
  });

  it("[S-MEM-3] counts a try on every note for the same action and property, and leaves the rest alone", () => {
    const notes = record(record([], tried([fed]), rate), tried([near], "grab", "edible"), rate);
    const after = record(notes, tried([fed]), rate);
    expect(after.map(({ action, tries, score }) => [action, tries, score])).toEqual([
      ["use", 2, 1],
      ["grab", 1, 1],
    ]);
  });

  it("[S-MEM-2] keeps the property and never the thing, whatever thing it was learned on", () => {
    const [note] = record([], tried([near]), rate);
    expect(Object.keys(note ?? {}).sort()).toEqual([
      "action",
      "effect",
      "property",
      "score",
      "tries",
    ]);
    expect(note?.effect.object).toBe("$thing");
  });
});

describe("tries on a property", () => {
  it("[S-DRIVE-4] adds up the tries of each action on it, counting each action once", () => {
    const notes = record(
      record(record([], tried([fed, near]), rate), tried([fed, near]), rate),
      tried([], "grab"),
      rate,
    );
    expect(triesOn(notes, "edible")).toBe(3);
    expect(triesOn(notes, "soft")).toBe(0);
  });
});

describe("retrieval", () => {
  const many = Array.from(
    { length: 12 },
    (_, i) =>
      record(
        [],
        tried([{ ...fed, predicate: `p${String(i).padStart(2, "0")}` }], "use", `q${String(i)}`),
        rate,
      )[0],
  ).filter((note) => note !== undefined);

  const nth = (i: number): (typeof many)[number] => {
    const found = many[i];
    if (!found) throw new Error(`no note ${String(i)}`);
    return found;
  };

  it("[S-MEM-4] returns at most 8 notes", () => {
    expect(retrieve(many, fed, [])).toHaveLength(8);
  });

  it("[S-MEM-4] ranks notes about the goal and about what is in view first", () => {
    const goalNote = { ...nth(11), effect: fed };
    const inView = nth(10);
    const both = { ...nth(9), effect: fed };
    const ranked = retrieve([...many.slice(0, 9), both, inView, goalNote], fed, [
      inView.property,
      both.property,
    ]);
    expect(ranked.slice(0, 3)).toEqual([both, goalNote, inView]);
  });

  it("[S-MEM-4] keeps the order notes were made in among equals", () => {
    expect(retrieve(many.slice(0, 3), fed, [])).toEqual(many.slice(0, 3));
  });
});

describe("amending a try with what followed", () => {
  it("[S-MEM-3] counts a late effect as a hit for its note, without counting another try", () => {
    const missed = record(record([], tried([fed]), rate), tried([]), rate);
    const amended = amend(missed, tried([fed]), false, rate);
    expect(amended.find(({ effect }) => effect === fed)).toMatchObject({ tries: 2, score: 1 });
  });

  it("[S-MEM-3] makes a note for a late effect never seen before", () => {
    const amended = amend(record([], tried([]), rate), tried([near]), false, rate);
    expect(amended.find(({ effect }) => effect === near)).toEqual({
      action: "use",
      property: "edible",
      effect: near,
      tries: 1,
      score: 1,
    });
  });

  it("[S-MEM-3] takes back the hit it gave nothing happening, when something did after all", () => {
    const quiet = record([], tried([]), rate);
    const amended = amend(quiet, tried([near]), true, rate);
    expect(amended.find(({ effect }) => effect === NOTHING)).toMatchObject({
      tries: 1,
      score: 0.5,
    });
  });

  it("[S-MEM-3] changes nothing when nothing more followed", () => {
    const notes = record([], tried([fed]), rate);
    expect(amend(notes, tried([]), false, rate)).toEqual(notes);
  });
});

describe("retrieval for trying things", () => {
  it("[S-MEM-4] shows one note for each action and property before showing a second", () => {
    const busy = record([], tried([fed, near, { ...near, value: false }]), rate);
    const others = ["grab", "jump", "move_to"].flatMap((action) =>
      record([], tried([], action as Tried["action"]), rate),
    );
    const shown = retrieve([...busy, ...busy.slice(1), ...others], fed, []);
    expect(
      shown
        .map(({ action }) => action)
        .slice(0, 4)
        .sort(),
    ).toEqual(["grab", "jump", "move_to", "use"]);
  });
});
