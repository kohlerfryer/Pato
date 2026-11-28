import { describe, expect, it } from "vitest";

import { NOTHING } from "../agent/notes.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import type { TraceEvent } from "../kernel/trace.ts";
import { importsOf, sources } from "../evals/sources.ts";
import { createNoteLearner } from "./notes.ts";

type Data = TraceEvent["data"];
const at = (t: number, type: TraceEvent["type"], data: Data, agent = "a"): TraceEvent => ({
  t,
  agent,
  type,
  data,
});
/** A fact event: `about` is the subject and predicate, as "a hunger". */
const fact = (t: number, about: string, value: unknown, more: Data = {}): TraceEvent => {
  const [subject, predicate] = about.split(" ");
  return at(t, "fact", { subject, predicate, value, confidence: 1, source: "sight", ...more });
};
const start = (t: number, kind: string, target?: string): TraceEvent =>
  at(t, "action", { phase: "start", action: target === undefined ? { kind } : { kind, target } });
const end = (t: number, kind: string, status = "done"): TraceEvent =>
  at(t, "action", { phase: "end", action: { kind }, status });
const second = TICKS_PER_SECOND;

/** A duck that sees an edible thing b, uses it at tick 10, and gets less hungry. */
const eating: TraceEvent[] = [
  fact(1, "b edible", true),
  fact(1, "a hunger", 0.4, { source: "body" }),
  fact(1, "a near", true, { object: "b" }),
  at(5, "skill", { phase: "start", skill: "poke" }),
  start(10, "use", "b"),
  fact(10, "a hunger", 0, { source: "body" }),
  end(10, "use"),
];
const later = (t: number): TraceEvent => fact(t, "c soft", true);

function learned(events: TraceEvent[], rate = 0.5) {
  const learner = createNoteLearner("a", rate);
  for (const event of events) learner.learn([event]);
  return learner.notes();
}

describe("the note learner", () => {
  it("[S-LEARN-2] notes what changed for the agent within a second of an action, against the target's properties", () => {
    expect(learned([...eating, later(10 + second + 1)])).toEqual([
      {
        action: "use",
        property: "edible",
        effect: { subject: "$self", predicate: "hunger", op: "below", value: 0.01 },
        tries: 1,
        score: 1,
      },
    ]);
  });

  it("[S-LEARN-2] waits out the second before noting anything", () => {
    expect(learned([...eating, later(10 + second)])).toEqual([]);
  });

  it("[S-LEARN-2] counts changes up to a second after the action ended", () => {
    const slow = [
      ...eating.slice(0, -2),
      end(10, "use"),
      fact(10 + second, "a wet", false, { source: "body" }),
    ];
    const effects = learned([...slow, later(10 + second + 1)]).map(
      ({ effect }) => effect.predicate,
    );
    expect(effects).toEqual(["wet"]);
  });

  it("[S-LEARN-2] writes a relation to the target as $thing, and leaves out relations to other things", () => {
    const walk = [
      fact(1, "h has_opening", true),
      start(3, "move_to", "h"),
      fact(4, "a inside", true, { object: "h" }),
      fact(4, "a near", true, { object: "z" }),
      end(4, "move_to"),
      later(4 + second + 1),
    ];
    expect(learned(walk).map(({ effect }) => effect)).toEqual([
      { subject: "$self", predicate: "inside", object: "$thing", op: "is", value: true },
    ]);
  });

  it("[S-LEARN-2] notes a rise as above, and ignores numbers that barely moved", () => {
    const hop = [
      fact(1, "k flat_top", true),
      fact(1, "a level", 0, { source: "body" }),
      fact(1, "a sleepiness", 0.3, { source: "body" }),
      start(3, "jump", "k"),
      fact(3, "a level", 1, { source: "body" }),
      fact(3, "a sleepiness", 0.31, { source: "body" }),
      end(3, "jump"),
      later(3 + second + 1),
    ];
    expect(learned(hop).map(({ effect }) => effect)).toEqual([
      { subject: "$self", predicate: "level", op: "above", value: 0.99 },
    ]);
  });

  it("[S-LEARN-2] aims an action with no target at what the skill last aimed at", () => {
    const hop = [
      fact(1, "k flat_top", true),
      at(2, "skill", { phase: "start", skill: "hop" }),
      start(2, "move_to", "k"),
      end(3, "move_to"),
      start(4, "jump"),
      end(4, "jump", "failed"),
      later(4 + second + 1),
    ];
    const jumps = learned(hop).filter(({ action }) => action === "jump");
    expect(jumps).toEqual([
      { action: "jump", property: "flat_top", effect: NOTHING, tries: 1, score: 1 },
    ]);
  });

  it("[S-LEARN-2] notes each property of the target, and nothing for a target with none it knows of", () => {
    const both = [fact(0, "b soft", true), ...eating, later(10 + second + 1)];
    expect(learned(both).map(({ property }) => property)).toEqual(["edible", "soft"]);
    const blind = eating.filter(({ data }) => data.predicate !== "edible");
    expect(learned([...blind, later(10 + second + 1)])).toEqual([]);
  });

  it("[S-LEARN-2] forgets what a forgotten fact said", () => {
    const gone = [
      fact(1, "b edible", true),
      at(2, "fact", { subject: "b", predicate: "edible", forgotten: true }),
    ];
    expect(
      learned([...gone, ...eating, later(10 + second + 1)]).map(({ property }) => property),
    ).toEqual(["edible"]);
    const never = [...gone, ...eating.slice(1).filter(({ data }) => data.predicate !== "edible")];
    expect(learned([...never, later(10 + second + 1)])).toEqual([]);
  });

  it("[S-LEARN-1] learns only from its own agent's events, and keeps its notes to itself", () => {
    const others = eating.map((event) => ({ ...event, agent: "b" }));
    expect(learned([...others, later(10 + second + 1)])).toEqual([]);
    const one = createNoteLearner("a", 0.5);
    const two = createNoteLearner("a", 0.5);
    one.learn([...eating, later(10 + second + 1)]);
    expect(two.notes()).toEqual([]);
  });

  it("[S-LEARN-1] is given trace events alone: learners import nothing from the world, the senses or the kernel's loop", () => {
    const learners = sources().filter(
      ({ path }) => path.startsWith("src/learners/") && !path.endsWith(".test.ts"),
    );
    expect(learners.length).toBeGreaterThan(0);
    const reached = learners.flatMap((source) => importsOf(source));
    expect(
      reached.filter((path) => /src\/(world|sense|sim)\/|src\/kernel\/loop/.test(path)),
    ).toEqual([]);
  });
});
