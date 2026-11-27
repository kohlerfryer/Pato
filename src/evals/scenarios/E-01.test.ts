import { describe, expect, it } from "vitest";

import thresholds from "../../../evals/thresholds.json";
import { loadContent } from "../../content/content.ts";
import { loadScenarios } from "../../content/scenarios.ts";
import { TICKS_PER_SECOND } from "../../kernel/clock.ts";
import { everFell, levels, median, perMinute, shareBelow } from "../measure.ts";
import { writeReport } from "../report.ts";
import { runScenario } from "../run.ts";
import { type ParsedTrace, parseTrace, select } from "../trace.ts";

const ID = "E-01";
const limits = thresholds[ID];
const [scenario] = loadScenarios();
if (!scenario) throw new Error("there is no scenario to run");

const ticks = scenario.horizon_s * TICKS_PER_SECOND;
const needs = [...new Set(scenario.setup.agents.flatMap(({ state }) => Object.keys(state)))];
const traces = runScenario(scenario, loadContent()).map((trace) => parseTrace(trace.text()));

/** The one agent in this scenario. */
const agentIn = (trace: ParsedTrace): string =>
  trace.events.find((event) => event.agent !== null)?.agent ?? "";

const levelsOf = (trace: ParsedTrace, predicate: string): number[] =>
  levels(trace, { agent: agentIn(trace), predicate, ticks });

/** The share of ticks on which the worse-kept need was still below the limit. */
const worstShare = (trace: ParsedTrace): number =>
  Math.min(...needs.map((need) => shareBelow(levelsOf(trace, need), limits.max_drive)));

const share = median(traces.map(worstShare));
const switches = median(traces.map((trace) => perMinute(select(trace, "goal").length, ticks)));
const everyNeedMet = traces.every((trace) =>
  needs.every((need) => everFell(levelsOf(trace, need))),
);
const pass =
  share >= limits.min_share_of_ticks_below_max &&
  everyNeedMet &&
  switches <= limits.max_goal_switches_per_min;

writeReport(ID, {
  pass,
  values: {
    share_of_ticks_below_max: share,
    every_need_met_once: everyNeedMet,
    goal_switches_per_min: switches,
  },
});

describe("alone and alive", () => {
  it("[E-01] runs the setup the thresholds describe, once per seed", () => {
    expect(scenario.horizon_s).toBe(limits.horizon_s);
    const starts = scenario.setup.agents.flatMap(({ state }) => Object.values(state));
    expect(starts.every((level) => level === limits.start_drive)).toBe(true);
    expect(traces).toHaveLength(scenario.seeds.length);
    expect(needs).not.toEqual([]);
  });

  it("[E-01] keeps hunger and sleepiness below the limit on nearly every tick", () => {
    expect(share).toBeGreaterThanOrEqual(limits.min_share_of_ticks_below_max);
  });

  it("[E-01] eats and sleeps at least once", () => {
    expect(everyNeedMet).toBe(true);
  });

  it("[E-01] doesn't dither between goals", () => {
    expect(switches).toBeLessThanOrEqual(limits.max_goal_switches_per_min);
  });
});
