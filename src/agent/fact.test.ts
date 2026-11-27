import { describe, expect, it } from "vitest";

import { type Fact, factProblem } from "./fact.ts";

const fact: Fact = {
  subject: "a",
  predicate: "near",
  object: "b",
  value: true,
  confidence: 0.9,
  tEvent: 12,
  ttl: 30,
  source: "sight",
};

describe("factProblem", () => {
  it("[S-FACT-1] accepts a fact with every field", () => {
    expect(factProblem(fact)).toBeNull();
  });

  it("[S-FACT-1] accepts a fact about one entity, with no object", () => {
    const hunger: Fact = {
      subject: "a",
      predicate: "hunger",
      value: 0.4,
      confidence: 1,
      tEvent: 12,
      ttl: 1,
      source: "body",
    };
    expect(factProblem(hunger)).toBeNull();
  });

  it.each([-0.1, 1.1, Number.NaN])("[S-FACT-1] rejects a confidence of %s", (confidence) => {
    expect(factProblem({ ...fact, confidence })).toContain("confidence");
  });

  it.each([0, -3, 0.5])("[S-FACT-1] rejects a ttl of %s", (ttl) => {
    expect(factProblem({ ...fact, ttl })).toContain("ttl");
  });

  it("[S-FACT-1] accepts the edges: confidence 0 and 1, ttl 1", () => {
    expect(factProblem({ ...fact, confidence: 0, ttl: 1 })).toBeNull();
    expect(factProblem({ ...fact, confidence: 1 })).toBeNull();
  });
});
