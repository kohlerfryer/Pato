import { describe, expect, it } from "vitest";

import { parseDoc } from "./parse.ts";

describe("parseDoc", () => {
  it("reads a requirement with its phase", () => {
    const { items, problems } = parseDoc("- **R-01** (phase 2): The duck stays alive.", "prd.md");
    expect(problems).toEqual([]);
    expect(items).toEqual([
      {
        id: "R-01",
        kind: "R",
        refs: [],
        phase: 2,
        text: "The duck stays alive.",
        file: "prd.md",
        line: 1,
      },
    ]);
  });

  it("reads a spec item's references", () => {
    const { items } = parseDoc("- **S-FACT-3** (R-10, R-12, phase 1): Facts expire.", "spec.md");
    expect(items[0]).toMatchObject({ id: "S-FACT-3", kind: "S", refs: ["R-10", "R-12"], phase: 1 });
  });

  it("reads a scenario without a bullet", () => {
    const { items } = parseDoc("**E-02** (S-MEM-1, phase 3): New house.", "evals.md");
    expect(items[0]).toMatchObject({ id: "E-02", kind: "E", refs: ["S-MEM-1"], phase: 3 });
  });

  it("reads a deferred item", () => {
    const { items } = parseDoc("- **R-21** (deferred): A second duck.", "prd.md");
    expect(items[0]?.phase).toBe("deferred");
  });

  it("reports the line of each item", () => {
    const { items } = parseDoc(
      "# Title\n\n- **R-01** (phase 1): One.\n- **R-02** (phase 1): Two.",
      "p",
    );
    expect(items.map((item) => item.line)).toEqual([3, 4]);
  });

  it("ignores items inside fenced code", () => {
    const doc = "```\n- **R-99** (phase 1): An example.\n```\n- **R-01** (phase 1): Real.";
    expect(parseDoc(doc, "p").items.map((item) => item.id)).toEqual(["R-01"]);
  });

  it("ignores ordinary bold text", () => {
    expect(parseDoc("- **Setup:** food and a nest.", "p")).toEqual({ items: [], problems: [] });
  });

  it("flags an item with no brackets", () => {
    const { items, problems } = parseDoc("- **S-FACT-1** Facts have seven fields.", "spec.md");
    expect(items).toEqual([]);
    expect(problems).toMatchObject([{ rule: "bad-item", file: "spec.md", line: 1 }]);
  });

  it("flags an item with no phase", () => {
    const { problems } = parseDoc("- **S-FACT-1** (R-13): Facts have seven fields.", "spec.md");
    expect(problems[0]?.message).toContain("phase");
  });

  it("flags brackets it can't read", () => {
    const { problems } = parseDoc("- **S-FACT-1** (R-13, soon, phase 1): Facts.", "spec.md");
    expect(problems[0]?.message).toContain("soon");
  });
});
