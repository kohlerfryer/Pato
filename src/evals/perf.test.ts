import { describe, expect, it } from "vitest";

import { loadContent } from "../content/content.ts";
import { loadScenarios } from "../content/scenarios.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { createRun } from "./run.ts";

const MINUTES = 30;
const LIMIT_MS = 20_000;

describe("speed", () => {
  it(
    "[S-PERF-1] runs thirty simulated minutes of scenario 1 headless in under 20 seconds",
    () => {
      const [first] = loadScenarios();
      if (!first) throw new Error("there is no scenario to run");
      const { kernel } = createRun(first, loadContent(), 1);
      const started = performance.now();
      for (let i = 0; i < MINUTES * 60 * TICKS_PER_SECOND; i++) kernel.tick();
      const took = performance.now() - started;
      expect(took).toBeLessThan(LIMIT_MS);
    },
    LIMIT_MS * 2,
  );
});
