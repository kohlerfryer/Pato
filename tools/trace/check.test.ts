import { describe, expect, it } from "vitest";

import { check, citations, untested } from "./check.ts";
import { type Item, parseDoc } from "./parse.ts";
import { type TestFile, scanTest } from "./scan.ts";

const DOCS = [
  "- **R-01** (phase 1): Runs headless.",
  "- **R-02** (phase 2): Stays alive.",
  "- **R-09** (deferred): A second duck.",
  "- **S-TICK-1** (R-01, phase 1): Fixed tick.",
  "- **S-TICK-2** (R-01, phase 1): Seeded randomness.",
  "- **S-DRIVE-1** (R-02, phase 2): Drives have urgency.",
  "- **E-01** (S-DRIVE-1, phase 2): Alone and alive.",
].join("\n");

const items = (doc = DOCS): Item[] => [...parseDoc(doc, "docs.md").items];
const test = (titles: string): TestFile => scanTest(titles, "src/a.test.ts");
const rules = (doc: string, tests: TestFile[] = [], currentPhase = 1): string[] =>
  check({ items: items(doc), tests, currentPhase }).map((problem) => problem.rule);

describe("check", () => {
  it("passes consistent docs with no tests in the first phase", () => {
    expect(rules(DOCS)).toEqual([]);
  });

  it("flags an id defined twice", () => {
    expect(rules(`${DOCS}\n- **S-TICK-1** (R-01, phase 1): Again.`)).toEqual(["duplicate-id"]);
  });

  it("flags a reference to an id that doesn't exist", () => {
    expect(rules(`${DOCS}\n- **S-TICK-3** (R-77, phase 1): Lost.`)).toEqual(["unknown-ref"]);
  });

  it("flags a spec item that points at a scenario", () => {
    expect(rules(`${DOCS}\n- **S-TICK-3** (E-01, phase 2): Backwards.`)).toEqual(["wrong-ref"]);
  });

  it("flags a requirement that points at anything", () => {
    expect(rules(`${DOCS}\n- **R-03** (S-TICK-1, phase 1): Circular.`)).toContain("wrong-ref");
  });

  it("flags a spec item with no requirement", () => {
    expect(rules(`${DOCS}\n- **S-TICK-3** (phase 1): Why?`)).toEqual(["orphan"]);
  });

  it("flags a requirement no spec item answers", () => {
    expect(rules(`${DOCS}\n- **R-03** (phase 3): Unanswered.`)).toEqual(["unmet-requirement"]);
  });

  it("doesn't count a deferred spec item as answering a requirement", () => {
    const doc = `${DOCS}\n- **R-03** (phase 3): Later.\n- **S-LATE-1** (R-03, deferred): Maybe.`;
    expect(rules(doc)).toEqual(["unmet-requirement"]);
  });

  it("lets a deferred requirement go unanswered", () => {
    expect(rules(DOCS)).not.toContain("unmet-requirement");
  });

  it("flags a spec item scheduled after the requirement it serves", () => {
    expect(rules(`${DOCS}\n- **S-TICK-3** (R-01, phase 4): Too late.`)).toEqual(["phase-order"]);
  });

  it("flags a scenario scheduled before a spec item it checks", () => {
    expect(rules(`${DOCS}\n- **E-02** (S-DRIVE-1, phase 1): Too early.`)).toEqual(["phase-order"]);
  });

  it("flags a scheduled spec item serving a deferred requirement", () => {
    expect(rules(`${DOCS}\n- **S-DUO-1** (R-09, phase 2): Early.`)).toEqual(["phase-order"]);
  });

  it("allows a deferred spec item serving a deferred requirement", () => {
    expect(rules(`${DOCS}\n- **S-DUO-1** (R-09, deferred): Later.`)).toEqual([]);
  });

  it("flags a test citing an id that doesn't exist", () => {
    expect(rules(DOCS, [test('it("[S-NOPE-1] x", () => {});')])).toEqual(["unknown-tag"]);
  });

  it("flags a test citing a requirement instead of a spec item", () => {
    expect(rules(DOCS, [test('it("[R-01] x", () => {});')])).toEqual(["unknown-tag"]);
  });

  it("flags a test file that cites nothing", () => {
    expect(rules(DOCS, [test('it("adds", () => {});')])).toEqual(["untagged-test"]);
  });

  it("flags a skipped test", () => {
    expect(rules(DOCS, [test('it.skip("[S-TICK-1] x", () => {});')])).toEqual(["disabled-test"]);
  });

  it("allows untested items in the current phase", () => {
    expect(rules(DOCS, [test('it("[S-TICK-1] x", () => {});')], 1)).toEqual([]);
  });

  it("flags untested items of a passed phase", () => {
    const problems = check({
      items: items(),
      tests: [test('it("[S-TICK-1] x", () => {});')],
      currentPhase: 2,
    });
    expect(problems).toMatchObject([{ rule: "phase-gap", line: 5 }]);
    expect(problems[0]?.message).toContain("S-TICK-2");
  });

  it("passes a phase once every one of its items has a test", () => {
    const tests = [test('it("[S-TICK-1] x", () => {});\nit("[S-TICK-2] y", () => {});')];
    expect(rules(DOCS, tests, 2)).toEqual([]);
  });

  it("requires passed scenarios to have tests too", () => {
    const titles = ["S-TICK-1", "S-TICK-2", "S-DRIVE-1"].map((id) => `it("[${id}] x", () => {});`);
    const problems = check({ items: items(), tests: [test(titles.join("\n"))], currentPhase: 3 });
    expect(problems.map((problem) => problem.message)).toEqual([
      "E-01 belongs to a passed phase but no test cites it",
    ]);
  });
});

describe("citations", () => {
  it("counts how often each id is cited", () => {
    const tests = [test('it("[S-TICK-1] a", () => {});\nit("[S-TICK-1] b", () => {});')];
    expect(citations(tests).get("S-TICK-1")).toBe(2);
  });
});

describe("untested", () => {
  it("lists a phase's uncited items in document order, never requirements", () => {
    const ids = untested(items(), [], (phase) => phase === 1).map((item) => item.id);
    expect(ids).toEqual(["S-TICK-1", "S-TICK-2"]);
  });
});
