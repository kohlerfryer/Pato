import { describe, expect, it } from "vitest";

import { createTrace } from "../kernel/trace.ts";
import { everFell, levels, median, perMinute, shareBelow } from "./measure.ts";
import { parseTrace } from "./trace.ts";

function recorded(): ReturnType<typeof parseTrace> {
  const trace = createTrace(1, "test");
  const told = (t: number, agent: string, predicate: string, value: unknown): void => {
    trace.append({ t, agent, type: "fact", data: { subject: agent, predicate, value } });
  };
  told(1, "a", "hunger", 0.5);
  told(1, "a", "sleepiness", 0.1);
  told(2, "b", "hunger", 0.9);
  told(3, "a", "hunger", 0.7);
  trace.append({
    t: 3,
    agent: "a",
    type: "fact",
    data: { subject: "x", predicate: "hunger", value: 1 },
  });
  trace.append({ t: 4, agent: "a", type: "goal", data: { goal: null } });
  told(5, "a", "hunger", 0.2);
  return parseTrace(trace.text());
}

describe("levels", () => {
  it("[S-TRACE-3] gives an agent's own level at every tick, carrying the last one forward", () => {
    expect(levels(recorded(), { agent: "a", predicate: "hunger", ticks: 6 })).toEqual([
      0.5, 0.5, 0.7, 0.7, 0.2, 0.2,
    ]);
  });

  it("[S-TRACE-3] has no value before the agent was first told one", () => {
    const values = levels(recorded(), { agent: "b", predicate: "hunger", ticks: 3 });
    expect(values).toEqual([Number.NaN, 0.9, 0.9]);
  });

  it("[S-TRACE-3] reads nothing but the trace it is given", () => {
    const trace = recorded();
    expect(levels({ ...trace, events: [] }, { agent: "a", predicate: "hunger", ticks: 2 })).toEqual(
      [Number.NaN, Number.NaN],
    );
  });
});

describe("measures", () => {
  it("[S-EVAL-3] gives the share of values below a limit", () => {
    expect(shareBelow([0.1, 0.5, 0.79, 0.8, 0.9], 0.8)).toBeCloseTo(0.6, 10);
    expect(shareBelow([], 0.8)).toBe(0);
  });

  it("[S-EVAL-3] tells whether a level ever fell", () => {
    expect(everFell([0.1, 0.2, 0.3])).toBe(false);
    expect(everFell([0.1, 0.3, 0.2])).toBe(true);
    expect(everFell([Number.NaN, 0.3, 0.3])).toBe(false);
  });

  it("[S-EVAL-3] turns a count over some ticks into a rate per minute", () => {
    expect(perMinute(6, 30 * 30)).toBe(12);
  });

  it("[S-EVAL-3] takes the median of odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
