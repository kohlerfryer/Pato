import { describe, expect, it } from "vitest";

import { createBelief, forPlanner } from "./belief.ts";
import type { Fact } from "./fact.ts";

const near = (over: Partial<Fact> = {}): Fact => ({
  subject: "a",
  predicate: "near",
  object: "b",
  value: true,
  confidence: 0.8,
  tEvent: 10,
  ttl: 30,
  source: "sight",
  ...over,
});

describe("belief", () => {
  it("[S-FACT-2] holds one fact per subject, predicate and object", () => {
    const belief = createBelief();
    belief.add(near());
    belief.add(near({ object: "c" }));
    belief.add(near({ subject: "d" }));
    belief.add(near({ predicate: "inside" }));
    belief.add(near({ tEvent: 11, value: false }));
    expect(belief.facts()).toHaveLength(4);
    expect(belief.get({ subject: "a", predicate: "near", object: "b" })?.value).toBe(false);
  });

  it("[S-FACT-2] tells a fact about one entity from a relation with the same name", () => {
    const belief = createBelief();
    const alone: Fact = {
      subject: "a",
      predicate: "near",
      value: 1,
      confidence: 0.8,
      tEvent: 10,
      ttl: 30,
      source: "sight",
    };
    belief.add(alone);
    belief.add(near({ value: 2 }));
    expect(belief.get({ subject: "a", predicate: "near" })?.value).toBe(1);
    expect(belief.get({ subject: "a", predicate: "near", object: "b" })?.value).toBe(2);
  });

  it("[S-FACT-2] replaces a fact with a later one, even a less confident one", () => {
    const belief = createBelief();
    belief.add(near({ tEvent: 10, confidence: 0.9, value: "old" }));
    expect(belief.add(near({ tEvent: 11, confidence: 0.6, value: "new" }))).toBe(true);
    expect(belief.get(near())?.value).toBe("new");
  });

  it("[S-FACT-2] keeps the later fact when an earlier one arrives after it", () => {
    const belief = createBelief();
    belief.add(near({ tEvent: 11, value: "new" }));
    expect(belief.add(near({ tEvent: 10, confidence: 1, value: "old" }))).toBe(false);
    expect(belief.get(near())?.value).toBe("new");
  });

  it("[S-FACT-2] lets the more confident fact win at the same tick", () => {
    const belief = createBelief();
    belief.add(near({ confidence: 0.6, value: "unsure" }));
    belief.add(near({ confidence: 0.9, value: "sure" }));
    belief.add(near({ confidence: 0.7, value: "less sure" }));
    expect(belief.get(near())?.value).toBe("sure");
  });

  it("[S-FACT-1] refuses a malformed fact", () => {
    const belief = createBelief();
    expect(belief.add(near({ confidence: 2 }))).toBe(false);
    expect(belief.facts()).toEqual([]);
  });
});

describe("belief over time", () => {
  it("[S-FACT-3] still believes a fact on the last tick of its ttl", () => {
    const belief = createBelief();
    belief.add(near({ tEvent: 10, ttl: 30 }));
    belief.expire(40);
    expect(belief.facts()).toHaveLength(1);
  });

  it("[S-FACT-3] drops a fact on the first tick after tEvent plus ttl", () => {
    const belief = createBelief();
    belief.add(near({ tEvent: 10, ttl: 30 }));
    belief.expire(41);
    expect(belief.facts()).toEqual([]);
    expect(belief.get(near())).toBeUndefined();
  });

  it("[S-FACT-3] drops only the facts that have run out", () => {
    const belief = createBelief();
    belief.add(near({ object: "b", ttl: 1 }));
    belief.add(near({ object: "c", ttl: 5 }));
    belief.expire(12);
    expect(belief.facts().map((fact) => fact.object)).toEqual(["c"]);
  });

  it("[S-TRACE-5] hands back the facts it drops, so that forgetting can be recorded", () => {
    const belief = createBelief();
    belief.add(near({ object: "b", ttl: 1 }));
    belief.add(near({ object: "c", ttl: 5 }));
    expect(belief.expire(12).map((fact) => fact.object)).toEqual(["b"]);
    expect(belief.expire(13)).toEqual([]);
  });

  it("[S-FACT-3] gives a refreshed fact a fresh ttl", () => {
    const belief = createBelief();
    belief.add(near({ tEvent: 10, ttl: 5 }));
    belief.add(near({ tEvent: 14, ttl: 5 }));
    belief.expire(16);
    expect(belief.facts()).toHaveLength(1);
  });
});

describe("forPlanner", () => {
  it("[S-FACT-4] passes on only facts believed with a confidence of 0.5 or more", () => {
    const belief = createBelief();
    belief.add(near({ object: "sure", confidence: 0.9 }));
    belief.add(near({ object: "edge", confidence: 0.5 }));
    belief.add(near({ object: "doubtful", confidence: 0.49 }));
    expect(forPlanner(belief).map((fact) => fact.object)).toEqual(["sure", "edge"]);
  });

  it("[S-FACT-4] keeps the doubtful fact in belief itself", () => {
    const belief = createBelief();
    belief.add(near({ confidence: 0.2 }));
    expect(forPlanner(belief)).toEqual([]);
    expect(belief.facts()).toHaveLength(1);
  });
});
