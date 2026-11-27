import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

const FOLDER = "src/evals/scenarios";

/** `source` with its comments and its text in quotes taken out, leaving only code. */
const codeOnly = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g, "");

const tests = readdirSync(FOLDER)
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => ({ name, source: readFileSync(`${FOLDER}/${name}`, "utf8") }));

describe("scenario tests", () => {
  it("[S-EVAL-2] contain no thresholds of their own: no number appears in their code", () => {
    const withNumbers = tests
      .filter(({ source }) => /\d/.test(codeOnly(source)))
      .map(({ name }) => name);
    expect(withNumbers).toEqual([]);
    expect(tests.length).toBeGreaterThan(0);
  });

  it("[S-EVAL-2] read their pass criteria from evals/thresholds.json", () => {
    const without = tests
      .filter(({ source }) => !source.includes("evals/thresholds.json"))
      .map(({ name }) => name);
    expect(without).toEqual([]);
  });

  it("[S-EVAL-2] are checked by something that can tell code from text", () => {
    expect(codeOnly('const id = "E-01"; // within 5 seconds\nconst limit = `${x}7`;')).not.toMatch(
      /\d/,
    );
    expect(codeOnly('expect(share).toBeGreaterThan(0.95); /* 3 */ const s = "9";')).toContain(
      "0.95",
    );
  });
});
