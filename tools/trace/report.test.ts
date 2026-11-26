import { describe, expect, it } from "vitest";

import { type Item, parseDoc } from "./parse.ts";
import { nextItems, nextLines, problemLines, progress, summary } from "./report.ts";
import { scanTest } from "./scan.ts";

const DOCS = [
  "- **R-01** (phase 2): Something.",
  "- **E-01** (S-B-1, phase 1): A scenario listed first.",
  "- **S-A-1** (R-01, phase 1): First.",
  "- **S-A-2** (R-01, phase 1): Second.",
  "- **S-B-1** (R-01, phase 1): Third.",
  "- **S-C-1** (R-01, phase 2): Later.",
  "- **S-D-1** (R-01, deferred): Never mind.",
].join("\n");

const items: Item[] = [...parseDoc(DOCS, "docs/spec.md").items];
const tests = [scanTest('it("[S-A-1] x", () => {});', "src/a.test.ts")];

describe("problemLines", () => {
  it("prints file, line, rule and message", () => {
    const problem = { rule: "orphan", message: "S-X-1 points back to nothing", file: "f", line: 3 };
    expect(problemLines([problem])).toEqual(["f:3: orphan: S-X-1 points back to nothing"]);
  });
});

describe("progress", () => {
  it("counts tested items per phase, leaving out requirements and deferred items", () => {
    expect(progress(items, tests)).toEqual([
      { phase: 1, total: 4, covered: 1 },
      { phase: 2, total: 1, covered: 0 },
    ]);
  });
});

describe("summary", () => {
  it("marks the current phase", () => {
    expect(summary(items, tests, 1)).toEqual([
      "phase 1: 1/4 tested  <- current",
      "phase 2: 0/1 tested",
    ]);
  });
});

describe("nextItems", () => {
  it("lists the current phase's untested spec items before its scenarios", () => {
    expect(nextItems(items, tests, 1, 5).map((item) => item.id)).toEqual([
      "S-A-2",
      "S-B-1",
      "E-01",
    ]);
  });

  it("stops at the count asked for", () => {
    expect(nextItems(items, tests, 1, 1).map((item) => item.id)).toEqual(["S-A-2"]);
  });
});

describe("nextLines", () => {
  it("prints each item with where it is written", () => {
    expect(nextLines(nextItems(items, tests, 1, 1), 1)).toEqual([
      "S-A-2  Second.  (docs/spec.md:4)",
    ]);
  });

  it("says when the phase is ready for its gate", () => {
    expect(nextLines([], 3)[0]).toContain("phase 3");
  });
});
