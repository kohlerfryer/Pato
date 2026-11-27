import { describe, expect, it } from "vitest";

import { sources } from "../evals/sources.ts";
import { TICKS_PER_SECOND, createClock } from "./clock.ts";

const WALL_CLOCK = /\bDate\.now\b|\bnew Date\b|\bperformance\.now\b|\bsetTimeout\b|\bsetInterval\b/;

describe("clock", () => {
  it("[S-TICK-1] starts at tick 0 and advances one tick at a time", () => {
    const clock = createClock();
    expect(clock.t).toBe(0);
    expect(clock.tick()).toBe(1);
    expect(clock.tick()).toBe(2);
    expect(clock.t).toBe(2);
  });

  it("[S-TICK-1] counts thirty ticks to the second", () => {
    expect(TICKS_PER_SECOND).toBe(30);
  });

  it("[S-TICK-1] is the only clock: no code reads the wall clock except to measure a budget", () => {
    const readers = sources()
      .filter(({ path, text }) => WALL_CLOCK.test(text) && !path.includes("budget"))
      .map(({ path }) => path);
    expect(readers).toEqual([]);
  });
});

describe("sources", () => {
  it("[S-TICK-1] lists the game's code by repository path, leaving out tests", () => {
    const paths = sources().map(({ path }) => path);
    expect(paths).toContain("src/kernel/clock.ts");
    expect(paths.some((path) => path.endsWith(".test.ts"))).toBe(false);
  });
});
