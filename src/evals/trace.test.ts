import { describe, expect, it } from "vitest";

import { createTrace } from "../kernel/trace.ts";
import { parseTrace, select } from "./trace.ts";

function recorded(): string {
  const trace = createTrace(7, "empty world");
  trace.append({ t: 1, agent: "a", type: "goal", data: { goal: "rest" } });
  trace.append({ t: 1, agent: "b", type: "action", data: { kind: "jump" } });
  trace.append({ t: 2, agent: "a", type: "action", data: { kind: "drop" } });
  trace.append({ t: 3, agent: null, type: "world", data: {} });
  return trace.text();
}

describe("parseTrace", () => {
  it("[S-TRACE-3] reads back the header and every event of a written trace", () => {
    const parsed = parseTrace(recorded());
    expect(parsed.header).toEqual({ schema: 1, seed: 7, scenario: "empty world" });
    expect(parsed.events).toHaveLength(4);
    expect(parsed.events[2]).toEqual({ t: 2, agent: "a", type: "action", data: { kind: "drop" } });
  });

  it("[S-TRACE-3] refuses text with no header", () => {
    expect(() => parseTrace("")).toThrow("header");
  });
});

describe("select", () => {
  it("[S-TRACE-3] picks events by type from a parsed trace alone", () => {
    const actions = select(parseTrace(recorded()), "action");
    expect(actions.map(({ t, agent }) => [t, agent])).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });

  it("[S-TRACE-3] narrows to one agent when asked", () => {
    const actions = select(parseTrace(recorded()), "action", "a");
    expect(actions.map(({ data }) => data.kind)).toEqual(["drop"]);
  });
});
