/**
 * The note learner: watches its own agent's trace events, and after each action notes what changed
 * for the agent, once for each property of the thing acted on. It notes the try as soon as the
 * action ends, so the planner knows it was tried, and adds what follows within the next second.
 * It writes nothing but its own notes.
 */

import type { Condition } from "../agent/condition.ts";
import { type Tried, amend, record } from "../agent/notes.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import type { TraceEvent } from "../kernel/trace.ts";
import type { Note } from "../planner/planner.ts";

/** How long after an action its effects are looked for. */
const WINDOW = TICKS_PER_SECOND;
/** A number that moved less than this did not change, as far as learning goes. */
const NOTICEABLE = 0.05;
/** Numbers in a noted effect are kept to this many places. */
const PLACES = 100;
const THING = "$thing";

type Data = TraceEvent["data"];
type Value = boolean | number | string;

interface Held {
  readonly subject: string;
  readonly predicate: string;
  readonly object?: string;
  readonly value: Value;
}

/** An action under way: what it was, what it was aimed at, and how things stood when it began. */
interface Watching {
  readonly action: Note["action"];
  readonly target: string;
  readonly properties: readonly string[];
  readonly before: ReadonlyMap<string, Held>;
}

/** An action that has ended: noted at once, and settled once its second is up. */
interface Ended extends Watching {
  readonly until: number;
  /** The effects noted when it ended. */
  readonly noted: readonly Condition[];
}

const keyOf = ({ subject, predicate, object }: Readonly<Record<string, unknown>>): string =>
  [subject, predicate, object ?? ""].map(String).join("\u0000");

/** The effect of a number moving from `before` to `now`: below or above where it ended. */
function moved(
  base: Omit<Condition, "op" | "value">,
  before: number,
  now: number,
): Condition | null {
  if (Math.abs(now - before) < NOTICEABLE) return null;
  return now < before
    ? { ...base, op: "below", value: (Math.ceil(now * PLACES) + 1) / PLACES }
    : { ...base, op: "above", value: (Math.floor(now * PLACES) - 1) / PLACES };
}

/** The effect a change from `before` to `now` amounts to, or null if it doesn't count. */
function effectOf(before: Held | undefined, now: Held, target: string): Condition | null {
  if (now.object !== undefined && now.object !== target) return null;
  const object = now.object === undefined ? {} : { object: THING };
  const base = { subject: "$self", predicate: now.predicate, ...object };
  if (typeof now.value === "number" && typeof before?.value === "number")
    return moved(base, before.value, now.value);
  return before?.value === now.value ? null : { ...base, op: "is", value: now.value };
}

/** What changed for the agent since `span` began, as effects in a fixed order. */
function changes(now: ReadonlyMap<string, Held>, span: Watching): Condition[] {
  return [...now.entries()]
    .map(([key, fact]) => effectOf(span.before.get(key), fact, span.target))
    .filter((effect) => effect !== null)
    .sort((a, b) => keyOf({ ...a }).localeCompare(keyOf({ ...b })));
}

/** Notes a try, once for each property of what was acted on. Returns what it noted. */
function note(
  notes: Note[],
  now: ReadonlyMap<string, Held>,
  span: Watching,
  rate: number,
): Condition[] {
  const effects = changes(now, span);
  for (const property of span.properties)
    notes.splice(
      0,
      notes.length,
      ...record(notes, { action: span.action, property, effects }, rate),
    );
  return effects;
}

/** Corrects the notes of a try with what changed after it was noted. */
function settle(notes: Note[], now: ReadonlyMap<string, Held>, span: Ended, rate: number): void {
  const noted = new Set(span.noted.map((effect) => JSON.stringify(effect)));
  const effects = changes(now, span).filter((effect) => !noted.has(JSON.stringify(effect)));
  for (const property of span.properties) {
    const late: Tried = { action: span.action, property, effects };
    notes.splice(0, notes.length, ...amend(notes, late, span.noted.length === 0, rate));
  }
}

interface NoteLearner {
  readonly learn: (events: readonly TraceEvent[]) => void;
  readonly notes: () => readonly Note[];
}

export function createNoteLearner(self: string, rate: number): NoteLearner {
  const notes: Note[] = [];
  const held = new Map<string, Held>();
  const pending: Ended[] = [];
  let watching: Watching | undefined;
  let aimedAt: string | undefined;

  const own = (): Map<string, Held> =>
    new Map([...held].filter(([, fact]) => fact.subject === self));

  function begin({ action }: Data): void {
    const { kind, target } = (action ?? {}) as { kind?: Note["action"]; target?: unknown };
    if (typeof target === "string") aimedAt = target;
    const aim = typeof target === "string" ? target : aimedAt;
    if (kind === undefined || aim === undefined) return;
    const properties = [...held.values()]
      .filter((fact) => fact.subject === aim && fact.object === undefined && fact.value === true)
      .map(({ predicate }) => predicate)
      .sort();
    watching = { action: kind, target: aim, properties, before: own() };
  }

  function act(data: Data, t: number): void {
    if (data.phase === "start") begin(data);
    else if (watching) {
      pending.push({ ...watching, until: t + WINDOW, noted: note(notes, own(), watching, rate) });
      watching = undefined;
    }
  }

  function take({ t, type, data }: TraceEvent): void {
    for (let next = pending[0]; next && t > next.until; next = pending[0]) {
      pending.shift();
      settle(notes, own(), next, rate);
    }
    if (type === "fact" && data.forgotten === true) held.delete(keyOf(data));
    else if (type === "fact") held.set(keyOf(data), data as unknown as Held);
    else if (type === "skill" && data.phase === "start") aimedAt = undefined;
    else if (type === "action") act(data, t);
  }

  return {
    learn: (events) => {
      for (const event of events) if (event.agent === self) take(event);
    },
    notes: () => notes,
  };
}
