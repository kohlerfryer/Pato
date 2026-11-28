/**
 * What each agent believes and why it acts, in words, read from trace events and nothing else. A
 * recorded run can be inspected exactly as a live one is.
 */

import type { TraceEvent } from "../kernel/trace.ts";

type Data = TraceEvent["data"];

interface Believed {
  readonly subject: string;
  readonly predicate: string;
  readonly object?: string;
  readonly value: unknown;
  /** Which sense told it. */
  readonly source: string;
  /** The fact in words: "not near food-1", "hunger 0.31". */
  readonly text: string;
}

/** How an agent holds itself, from the action it has in progress. */
export type Pose = "walking" | "busy" | "standing";

export interface AgentView {
  readonly id: string;
  /** What it wants, in words, or null when it wants nothing. */
  readonly goal: string | null;
  /** What it last decided, said or guessed. */
  readonly thought: string | null;
  /** Everything it believes right now: about itself first, then about each other thing. */
  readonly beliefs: readonly Believed[];
  /** How urgent each drive was when it last chose a goal. */
  readonly urgencies: Readonly<Record<string, number>>;
  /** The skill it is in the middle of. */
  readonly skill: string | null;
  /** The action it is in the middle of, in words. */
  readonly action: string | null;
  /** What last failed, and why. */
  readonly failure: string | null;
  readonly pose: Pose;
}

const words = (parts: readonly unknown[]): string =>
  parts
    .filter((part) => part !== undefined)
    .map(String)
    .join(" ");

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? { ...value } : {};

/** A goal as the trace holds it, in words: "hunger below 0.2". */
function goalText(goal: unknown): string | null {
  if (typeof goal !== "object" || goal === null) return null;
  const { predicate, object, op, value } = record(goal);
  return words([predicate, object, op, value]);
}

/** A plan as the trace holds it, in words: what was said or guessed, or else the skill chosen. */
function thoughtText(data: Data): string {
  const spoken = data.say ?? data.guess;
  return typeof spoken === "string"
    ? spoken
    : words([data.skill, ...Object.values(record(data.args))]);
}

/** An action as the trace holds it, in words: "move_to food-1". */
function actionText(action: unknown): string {
  const { kind, target } = record(action);
  const spot = Object.values(record(target));
  return words([kind, spot.length > 0 ? spot.join(", ") : target]);
}

/** A believed fact in words. What the agent believes of itself leaves its own name out. */
function factText(self: string, { subject, predicate, object, value }: Data): string {
  const amount = typeof value === "number" ? value.toFixed(2) : value;
  return words([
    subject === self ? undefined : subject,
    value === false ? "not" : undefined,
    predicate,
    object,
    typeof value === "boolean" ? undefined : amount,
  ]);
}

/** What a fact is about, whether it comes from the trace or from the view. */
interface About {
  readonly subject?: unknown;
  readonly predicate?: unknown;
  readonly object?: unknown;
}

const sameFact = (a: About, b: About): boolean =>
  a.subject === b.subject && a.predicate === b.predicate && a.object === b.object;

/** Sorts what an agent believes of itself first, then by what each fact is about. */
const order = (self: string, { subject, predicate, object = "" }: Believed): string =>
  [subject === self ? "0" : "1", subject, predicate, object].join("\u0000");

function believe(agent: AgentView, data: Data): AgentView {
  const kept = agent.beliefs.filter((held) => !sameFact(held, data));
  if (data.forgotten === true) return { ...agent, beliefs: kept };
  const { subject, predicate, object, value, source } = data;
  const fact: Believed = {
    subject: String(subject),
    predicate: String(predicate),
    ...(typeof object === "string" ? { object } : {}),
    value,
    source: String(source),
    text: factText(agent.id, data),
  };
  const beliefs = [...kept, fact].sort((a, b) =>
    order(agent.id, a) < order(agent.id, b) ? -1 : 1,
  );
  return { ...agent, beliefs };
}

function skillEvent(agent: AgentView, { phase, skill, reason }: Data): AgentView {
  if (phase === "start") return { ...agent, skill: String(skill) };
  const failure = phase === "failed" ? words([`${String(skill)}:`, reason]) : agent.failure;
  return { ...agent, skill: null, failure };
}

/** Walking while moving, busy while using something, standing for anything over in a moment. */
function poseFor(action: unknown): Pose {
  const { kind } = record(action);
  if (kind === "move_to") return "walking";
  return kind === "use" ? "busy" : "standing";
}

function actionEvent(agent: AgentView, { phase, action, status, reason }: Data): AgentView {
  if (phase === "start") return { ...agent, action: actionText(action), pose: poseFor(action) };
  const failed = status === "failed";
  const failure = failed ? words([`${String(record(action).kind)}:`, reason]) : agent.failure;
  return { ...agent, action: null, failure, pose: "standing" };
}

function urgenciesIn(data: Data): Record<string, number> {
  const numbers = Object.entries(record(data.urgencies)).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  return Object.fromEntries(numbers);
}

/** What each type of event changes about the picture of an agent. */
const readers: Record<TraceEvent["type"], (agent: AgentView, data: Data) => AgentView> = {
  fact: believe,
  drive: (agent, data) => ({ ...agent, urgencies: urgenciesIn(data) }),
  goal: (agent, data) => ({ ...agent, goal: goalText(data.goal) }),
  plan: (agent, data) =>
    data.invalid === undefined ? { ...agent, thought: thoughtText(data) } : agent,
  skill: skillEvent,
  action: actionEvent,
  learn: (agent) => agent,
  world: (agent) => agent,
};

const unknown = (id: string): AgentView => ({
  id,
  goal: null,
  thought: null,
  beliefs: [],
  urgencies: {},
  skill: null,
  action: null,
  failure: null,
  pose: "standing",
});

/** The picture of each agent, brought up to date with `events`, in id order. */
export function follow(previous: readonly AgentView[], events: readonly TraceEvent[]): AgentView[] {
  const agents = new Map(previous.map((agent) => [agent.id, agent]));
  for (const { agent: id, type, data } of events) {
    if (id === null) continue;
    agents.set(id, readers[type](agents.get(id) ?? unknown(id), data));
  }
  return [...agents.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

const orNothing = (parts: readonly string[], joiner: string): string =>
  parts.length > 0 ? parts.join(joiner) : "nothing";

/** The inspector, as lines of text: what the agent wants, why, what it is doing and believes. */
export function lines(agent: AgentView): string[] {
  const pressing = Object.entries(agent.urgencies)
    .sort(([, a], [, b]) => b - a)
    .map(([drive, urgency]) => `${drive} ${urgency.toFixed(2)}`);
  const doing = [agent.skill, agent.action].filter((part) => part !== null);
  const wants = `${agent.id} wants ${agent.goal ?? "nothing"}`;
  return [
    agent.thought === null ? wants : `${wants} · ${agent.thought}`,
    `why: ${pressing.length > 0 ? pressing.join(", ") : "nothing pressing"}`,
    `doing: ${orNothing(doing, " → ")}`,
    `believes: ${orNothing(
      agent.beliefs.map(({ text }) => text),
      ", ",
    )}`,
    `last failure: ${agent.failure ?? "none"}`,
  ];
}
