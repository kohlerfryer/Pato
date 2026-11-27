import { describe, expect, it } from "vitest";

import { importsOf, sources } from "../evals/sources.ts";

const INSIDE = ["src/planner/", "src/agent/"];
const OFF_LIMITS = ["src/world/", "src/sim/"];

describe("importsOf", () => {
  it("[S-PLAN-3] resolves a file's relative imports to repository paths", () => {
    const text = [
      'import { a } from "./near.ts";',
      'import type { B } from "../world/state.ts";',
      'import { c,\n  d } from "../../tools/trace/cli.ts";',
      'import { readFileSync } from "node:fs";',
    ].join("\n");
    expect(importsOf({ path: "src/agent/sample.ts", text })).toEqual([
      "src/agent/near.ts",
      "src/world/state.ts",
      "tools/trace/cli.ts",
    ]);
  });
});

describe("the planner and the agent", () => {
  it("[S-PLAN-3] import nothing from the world or the simulated kid", () => {
    const reaching = sources()
      .filter(({ path }) => INSIDE.some((dir) => path.startsWith(dir)))
      .flatMap((source) =>
        importsOf(source)
          .filter((target) => OFF_LIMITS.some((dir) => target.startsWith(dir)))
          .map((target) => `${source.path} imports ${target}`),
      );
    expect(reaching).toEqual([]);
  });

  it("[S-PLAN-3] have code for the check to look at", () => {
    const inside = sources().filter(({ path }) => INSIDE.some((dir) => path.startsWith(dir)));
    expect(inside.length).toBeGreaterThan(5);
  });
});
