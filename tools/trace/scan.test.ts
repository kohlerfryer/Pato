import { describe, expect, it } from "vitest";

import { scanTest } from "./scan.ts";

describe("scanTest", () => {
  it("finds the ids a test cites, with their lines", () => {
    const source = 'it("[S-FACT-3] expires facts", () => {});\nit("[E-02] new house", () => {});';
    expect(scanTest(source, "a.test.ts").tags).toEqual([
      { id: "S-FACT-3", line: 1 },
      { id: "E-02", line: 2 },
    ]);
  });

  it("finds several ids on one line", () => {
    const { tags } = scanTest('it("[S-TICK-1] [S-TICK-2] ticks in order", () => {});', "a.test.ts");
    expect(tags.map((tag) => tag.id)).toEqual(["S-TICK-1", "S-TICK-2"]);
  });

  it("finds nothing in a test that cites nothing", () => {
    expect(scanTest('it("adds", () => {});', "a.test.ts")).toEqual({
      file: "a.test.ts",
      tags: [],
      disabled: [],
    });
  });

  it("finds tests that are switched off", () => {
    const source = 'it.skip("a", () => {});\nit("b", () => {});\ndescribe.only("c", () => {});';
    expect(scanTest(source, "a.test.ts").disabled).toEqual([1, 3]);
  });

  it("finds todo tests", () => {
    expect(scanTest('test.todo("later");', "a.test.ts").disabled).toEqual([1]);
  });
});
