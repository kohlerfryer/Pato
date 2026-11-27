import { describe, expect, it } from "vitest";

import { createBelief } from "./belief.ts";
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
