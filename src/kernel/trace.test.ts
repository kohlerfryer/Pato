import { describe, expect, it } from "vitest";

import { EVENT_TYPES, type TraceEvent, createTrace } from "./trace.ts";

const event = (over: Partial<TraceEvent> = {}): TraceEvent => ({
  t: 1,
  agent: "a",
  type: "action",
  data: { kind: "jump" },
  ...over,
});

describe("trace", () => {
  it("[S-TRACE-1] is JSON Lines: a header with schema, seed and scenario, then one event per line", () => {
    const trace = createTrace(7, "empty world");
    trace.append(event());
    trace.append(event({ t: 2, agent: null, type: "world", data: {} }));
    expect(trace.text()).toBe(
      [
        '{"schema":1,"seed":7,"scenario":"empty world"}',
        '{"t":1,"agent":"a","type":"action","data":{"kind":"jump"}}',
        '{"t":2,"agent":null,"type":"world","data":{}}',
        "",
      ].join("\n"),
    );
  });

  it("[S-TRACE-1] writes each event's fields in the same order however it was built", () => {
    const trace = createTrace(1, "s");
    trace.append({ data: {}, type: "goal", agent: "a", t: 3 });
    expect(trace.text().split("\n")[1]).toBe('{"t":3,"agent":"a","type":"goal","data":{}}');
  });

  it("[S-TRACE-1] keeps events in tick order, allowing several in one tick", () => {
    const trace = createTrace(1, "s");
    trace.append(event({ t: 2 }));
    trace.append(event({ t: 2 }));
    expect(() => {
      trace.append(event({ t: 1 }));
    }).toThrow("tick order");
    expect(trace.events.map(({ t }) => t)).toEqual([2, 2]);
  });

  it("[S-TRACE-2] has exactly eight event types", () => {
    expect([...EVENT_TYPES].sort()).toEqual(
      ["action", "drive", "fact", "goal", "learn", "plan", "skill", "world"].sort(),
    );
  });

  it.each(EVENT_TYPES)("[S-TRACE-2] accepts a %s event", (type) => {
    const trace = createTrace(1, "s");
    trace.append(event({ type }));
    expect(trace.events).toHaveLength(1);
  });

  it("[S-TRACE-2] throws on any other event type", () => {
    const trace = createTrace(1, "s");
    const stray = { ...event(), type: "mood" } as unknown as TraceEvent;
    expect(() => {
      trace.append(stray);
    }).toThrow("mood");
    expect(trace.events).toEqual([]);
  });
});
