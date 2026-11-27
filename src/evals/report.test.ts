import { readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { writeReport } from "./report.ts";

describe("writeReport", () => {
  it("[S-EVAL-3] writes a JSON report with pass or fail and every measured value", () => {
    const path = writeReport("S-TEST", { pass: false, values: { share: 0.93, ate: true } });
    expect(path).toBe(".quality/evals/S-TEST.json");
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      scenario: "S-TEST",
      pass: false,
      values: { share: 0.93, ate: true },
    });
    rmSync(path);
  });

  it("[S-EVAL-3] replaces the report from the run before", () => {
    writeReport("S-TEST", { pass: false, values: {} });
    const path = writeReport("S-TEST", { pass: true, values: { n: 1 } });
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ pass: true, values: { n: 1 } });
    rmSync(path);
  });
});
