/** The record of a run: one header line, then every event in tick order. Evals read nothing else. */

export const EVENT_TYPES = [
  "fact",
  "drive",
  "goal",
  "plan",
  "skill",
  "action",
  "learn",
  "world",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

export interface TraceEvent {
  /** The tick it happened on. */
  readonly t: number;
  /** The agent it concerns, or null for the world itself. */
  readonly agent: string | null;
  readonly type: EventType;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Trace {
  /** Adds an event. Throws on an unknown type or an event earlier than the last. */
  append(event: TraceEvent): void;
  readonly events: readonly TraceEvent[];
  /** The whole trace as JSON Lines. */
  text(): string;
}

const SCHEMA = 1;
const KNOWN: ReadonlySet<string> = new Set(EVENT_TYPES);

export function createTrace(seed: number, scenario: string): Trace {
  const events: TraceEvent[] = [];
  return {
    events,
    append({ t, agent, type, data }) {
      if (!KNOWN.has(type)) throw new Error(`unknown trace event type: ${type}`);
      const last = events.at(-1);
      if (last && t < last.t) throw new Error("trace events must be appended in tick order");
      events.push({ t, agent, type, data });
    },
    text() {
      const header = { schema: SCHEMA, seed, scenario };
      return [header, ...events].map((line) => `${JSON.stringify(line)}\n`).join("");
    },
  };
}
