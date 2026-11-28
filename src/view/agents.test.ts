import { describe, expect, it } from "vitest";

import type { TraceEvent } from "../kernel/trace.ts";
import { type AgentView, follow, lines } from "./agents.ts";

const event = (type: TraceEvent["type"], data: TraceEvent["data"], agent = "a"): TraceEvent => ({
  t: 1,
  agent,
  type,
  data,
});
const sees = (data: TraceEvent["data"]): TraceEvent =>
  event("fact", { confidence: 1, source: "sight", ...data });
const after = (events: TraceEvent[], previous: readonly AgentView[] = []): AgentView | undefined =>
  follow(previous, events)[0];
const told = (agent: AgentView | undefined): string[] =>
  (agent?.beliefs ?? []).map(({ text, source }) => `${text} (${source})`);

describe("what an agent believes", () => {
  const snack = sees({ subject: "b", predicate: "edible", value: true });
  const far = sees({ subject: "a", predicate: "near", object: "b", value: false });
  const hungry = event("fact", {
    subject: "a",
    predicate: "hunger",
    value: 0.3149,
    source: "body",
  });

  it("[S-INSPECT-1] lists each fact in the trace with where it came from", () => {
    expect(told(after([snack, far, hungry]))).toEqual([
      "hunger 0.31 (body)",
      "not near b (sight)",
      "b edible (sight)",
    ]);
  });

  it("[S-INSPECT-1] keeps the fact itself beside its wording", () => {
    expect(after([far])?.beliefs).toEqual([
      {
        subject: "a",
        predicate: "near",
        object: "b",
        value: false,
        source: "sight",
        text: "not near b",
      },
    ]);
  });

  it("[S-INSPECT-1] replaces a fact when the trace says it changed", () => {
    const close = sees({ subject: "a", predicate: "near", object: "b", value: true });
    expect(told(after([far, close]))).toEqual(["near b (sight)"]);
  });

  it("[S-INSPECT-1] drops a fact the trace says was forgotten", () => {
    const gone = event("fact", { subject: "b", predicate: "edible", forgotten: true });
    expect(told(after([snack, far, gone]))).toEqual(["not near b (sight)"]);
  });

  it("[S-INSPECT-1] words a value that is neither a number nor yes or no as it stands", () => {
    const blue = sees({ subject: "b", predicate: "colour", value: "blue" });
    expect(told(after([blue]))).toEqual(["b colour blue (sight)"]);
  });

  it("[S-INSPECT-1] keeps each agent's beliefs apart", () => {
    const [a, b] = follow([], [snack, event("fact", { ...far.data, subject: "c" }, "c")]);
    expect(a?.beliefs).toHaveLength(1);
    expect(b?.beliefs).toHaveLength(1);
  });
});

describe("why an agent acts", () => {
  const start = event("skill", { phase: "start", skill: "eat", args: { food: "b" } });
  const walk = event("action", { phase: "start", action: { kind: "move_to", target: "b" } });

  it("[S-INSPECT-1] gives the urgency of each drive at the last goal change", () => {
    const first = event("drive", { urgencies: { hunger: 0.3, sleepiness: 0.24 } });
    const later = event("drive", { urgencies: { hunger: 0.1, sleepiness: 0.5 } });
    expect(after([first])?.urgencies).toEqual({ hunger: 0.3, sleepiness: 0.24 });
    expect(after([first, later])?.urgencies).toEqual({ hunger: 0.1, sleepiness: 0.5 });
  });

  it("[S-INSPECT-1] gives the skill and the action in progress", () => {
    expect(after([start, walk])).toMatchObject({ skill: "eat", action: "move_to b" });
  });

  it("[S-INSPECT-1] words an action with no target, or with a spot for one", () => {
    const hop = event("action", { phase: "start", action: { kind: "jump" } });
    const to = event("action", {
      phase: "start",
      action: { kind: "move_to", target: { x: 1, y: 2 } },
    });
    expect(after([hop])?.action).toBe("jump");
    expect(after([to])?.action).toBe("move_to 1, 2");
  });

  it("[S-INSPECT-1] shows nothing in progress once the action and the skill have ended", () => {
    const arrived = event("action", { phase: "end", action: { kind: "move_to" }, status: "done" });
    const done = event("skill", { phase: "done", skill: "eat" });
    expect(after([start, walk, arrived])).toMatchObject({ skill: "eat", action: null });
    expect(after([start, walk, arrived, done])).toMatchObject({ skill: null, action: null });
  });

  it("[S-INSPECT-1] gives the reason for the last failure, of an action or of a skill", () => {
    const missed = event("action", {
      phase: "end",
      action: { kind: "use", target: "b" },
      status: "failed",
      reason: "too_far",
    });
    const unmet = event("skill", { phase: "failed", skill: "eat", reason: "effect_unmet" });
    expect(after([start])?.failure).toBeNull();
    expect(after([start, missed])?.failure).toBe("use: too_far");
    expect(after([start, missed, unmet])?.failure).toBe("eat: effect_unmet");
  });

  it("[S-INSPECT-1] does not count an interruption as a failure", () => {
    const cut = event("action", {
      phase: "end",
      action: { kind: "use" },
      status: "interrupted",
      reason: "new_goal",
    });
    const dropped = event("skill", { phase: "interrupted", skill: "eat", reason: "new_goal" });
    expect(after([start, walk, cut, dropped])).toMatchObject({ skill: null, failure: null });
  });

  it("[S-INSPECT-1] carries everything forward from the view before", () => {
    const first = follow([], [start, walk, event("drive", { urgencies: { hunger: 0.3 } })]);
    expect(follow(first, [event("learn", {})])).toEqual(first);
  });

  it("[S-INSPECT-1] starts an agent with nothing known about it", () => {
    expect(after([event("learn", {})])).toEqual({
      id: "a",
      goal: null,
      thought: null,
      beliefs: [],
      urgencies: {},
      skill: null,
      action: null,
      failure: null,
      pose: "standing",
    });
  });
});

describe("pose", () => {
  const starts = (kind: string): TraceEvent =>
    event("action", { phase: "start", action: { kind } });
  const ends = event("action", { phase: "end", action: { kind: "use" }, status: "done" });

  it("[S-DRAW-8] walks while moving, is busy while using something, and stands otherwise", () => {
    expect(after([starts("move_to")])?.pose).toBe("walking");
    expect(after([starts("use")])?.pose).toBe("busy");
    expect(after([starts("jump")])?.pose).toBe("standing");
    expect(after([starts("grab")])?.pose).toBe("standing");
  });

  it("[S-DRAW-8] stands again once the action ends, however it ended", () => {
    expect(after([starts("use"), ends])?.pose).toBe("standing");
    const cut = event("action", {
      phase: "end",
      action: { kind: "move_to" },
      status: "interrupted",
    });
    expect(after([starts("move_to"), cut])?.pose).toBe("standing");
  });
});

describe("the inspector's lines", () => {
  const events = [
    event("drive", { urgencies: { sleepiness: 0.24, hunger: 0.3 } }),
    event("goal", { goal: { subject: "$self", predicate: "hunger", op: "below", value: 0.2 } }),
    event("plan", { skill: "eat", args: { food: "b" } }),
    event("skill", { phase: "start", skill: "eat", args: { food: "b" } }),
    event("action", { phase: "start", action: { kind: "move_to", target: "b" } }),
    sees({ subject: "b", predicate: "edible", value: true }),
    event("fact", { subject: "a", predicate: "hunger", value: 0.3, source: "body" }),
  ];

  it("[S-INSPECT-1] say what it wants, why, what it is doing, what it believes and what last failed", () => {
    const [agent] = follow([], events);
    expect(agent && lines(agent)).toEqual([
      "a wants hunger below 0.2 · eat b",
      "why: hunger 0.30, sleepiness 0.24",
      "doing: eat → move_to b",
      "believes: hunger 0.30, b edible",
      "last failure: none",
    ]);
  });

  it("[S-INSPECT-1] say so plainly when there is nothing to tell", () => {
    const [agent] = follow([], [event("learn", {})]);
    expect(agent && lines(agent)).toEqual([
      "a wants nothing",
      "why: nothing pressing",
      "doing: nothing",
      "believes: nothing",
      "last failure: none",
    ]);
  });
});
