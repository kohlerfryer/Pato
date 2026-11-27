import { describe, expect, it } from "vitest";

import { sources } from "../evals/sources.ts";
import { type Random, createStreams } from "./random.ts";

const draw = (random: Random, count = 5): number[] => Array.from({ length: count }, random);

describe("createStreams", () => {
  it("[S-TICK-3] gives the same numbers for the same seed and subsystem", () => {
    expect(draw(createStreams(7).stream("world"))).toEqual(draw(createStreams(7).stream("world")));
  });

  it("[S-TICK-3] gives each subsystem its own numbers", () => {
    const streams = createStreams(7);
    expect(draw(streams.stream("world"))).not.toEqual(draw(streams.stream("sight")));
  });

  it("[S-TICK-3] derives every stream from the run's seed", () => {
    expect(draw(createStreams(7).stream("world"))).not.toEqual(
      draw(createStreams(8).stream("world")),
    );
  });

  it("[S-TICK-3] keeps one stream per subsystem, however often it is asked for", () => {
    const streams = createStreams(7);
    const first = draw(streams.stream("world"), 2);
    const next = draw(streams.stream("world"), 2);
    expect([...first, ...next]).toEqual(draw(createStreams(7).stream("world"), 4));
  });

  it("[S-TICK-3] leaves one stream untouched when another is drawn from", () => {
    const busy = createStreams(7);
    draw(busy.stream("sight"), 100);
    expect(draw(busy.stream("world"))).toEqual(draw(createStreams(7).stream("world")));
  });

  it("[S-TICK-3] draws numbers from 0 up to but not including 1", () => {
    const numbers = draw(createStreams(1).stream("world"), 1000);
    expect(numbers.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(new Set(numbers).size).toBeGreaterThan(990);
  });

  it("[S-TICK-3] is the only randomness: no code calls Math.random", () => {
    const callers = sources()
      .filter(({ text }) => text.includes("Math.random"))
      .map(({ path }) => path);
    expect(callers).toEqual([]);
  });
});
