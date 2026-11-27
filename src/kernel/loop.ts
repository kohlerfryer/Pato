/**
 * The tick loop. Each tick, in this order: the world steps, sensors report, belief updates, drives
 * set goals, planners choose, executors act, learners look on, and the tick's events join the trace.
 */

import type { Action, Outcome } from "../agent/action.ts";
import { type Belief, createBelief, forPlanner } from "../agent/belief.ts";
import { choiceProblem } from "../agent/choice.ts";
import type { Condition } from "../agent/condition.ts";
import { type Executor, createExecutor } from "../agent/executor.ts";
import type { EntityId, Fact } from "../agent/fact.ts";
import { type Registry, createRegistry } from "../agent/registry.ts";
import type { Skill } from "../agent/skill.ts";
import type { Note, PlanOutput, Planner } from "../planner/planner.ts";
import type { WorldState } from "../world/state.ts";
import { step } from "../world/step.ts";
import { createClock } from "./clock.ts";
import { type Random, createStreams } from "./random.ts";
import { type Trace, type TraceEvent, createTrace } from "./trace.ts";

/** Reports what one agent can tell about the world this tick. */
export type Sensor = (view: {
  readonly t: number;
  readonly world: WorldState;
  readonly self: EntityId;
  readonly random: Random;
}) => readonly Fact[];

export interface AgentSetup {
  readonly id: EntityId;
  readonly sensors: readonly Sensor[];
  /** What the agent wants right now, given what it believes; null when it wants nothing. */
  readonly drives: (belief: Belief, t: number) => Condition | null;
  readonly planner: Planner;
  readonly skills: readonly Skill[];
  readonly notes: readonly Note[];
  /** Each is shown the tick's events, before they join the trace. */
  readonly learners: readonly ((events: readonly TraceEvent[]) => void)[];
}

interface Agent {
  readonly id: EntityId;
  readonly setup: AgentSetup;
  readonly belief: Belief;
  readonly registry: Registry;
  readonly memory: { readonly notes: Note[] };
  readonly executor: Executor;
  goal: Condition | null;
}

export interface Kernel {
  readonly trace: Trace;
  /** The agents, in id order. */
  readonly agents: readonly Pick<Agent, "id" | "belief" | "registry" | "memory">[];
  readonly world: WorldState;
  /** Runs one tick. */
  tick(): void;
}

type ActionRules = Parameters<typeof step>[2];

/** Writes one event about an agent into the tick's events. */
type Log = (type: TraceEvent["type"], data: Record<string, unknown>) => void;

function createAgent(setup: AgentSetup): Agent {
  const registry = createRegistry();
  for (const skill of setup.skills) {
    const problem = registry.register(skill);
    if (problem !== null) throw new Error(problem);
  }
  return {
    id: setup.id,
    setup,
    belief: createBelief(),
    registry,
    memory: { notes: [...setup.notes] },
    executor: createExecutor(),
    goal: null,
  };
}

/** Takes the sensed facts into belief, logging each one that tells the agent something new. */
function takeIn(agent: Agent, facts: readonly Fact[], t: number, emit: Log): void {
  for (const fact of facts) {
    const before = agent.belief.get(fact);
    if (!agent.belief.add(fact) || before?.value === fact.value) continue;
    const { subject, predicate, object, value, confidence, source } = fact;
    emit("fact", { subject, predicate, object, value, confidence, source });
  }
  agent.belief.expire(t);
}

/** Asks the drives what the agent wants, logging the goal when it changes. */
function aim(agent: Agent, t: number, emit: Log): void {
  const goal = agent.setup.drives(agent.belief, t);
  if (JSON.stringify(goal) !== JSON.stringify(agent.goal)) emit("goal", { goal });
  agent.goal = goal;
}

/** Asks the planner for a choice and checks it. Returns the choice only if it may run. */
function plan(agent: Agent, emit: Log): PlanOutput | null {
  if (!agent.goal || agent.executor.busy) return null;
  const choice = agent.setup.planner({
    goal: agent.goal,
    beliefs: forPlanner(agent.belief),
    skills: agent.registry
      .list()
      .map(({ id, params, pre, effects }) => ({ id, params, pre, effects })),
    notes: agent.memory.notes,
  });
  if (!choice) return null;
  const { registry, belief, id: self } = agent;
  const invalid = choiceProblem(choice, { registry, belief, self });
  emit("plan", invalid === null ? { ...choice } : { ...choice, invalid });
  return invalid === null ? choice : null;
}

/** Starts the chosen skill, if any, and moves the executor on. Returns the action to ask of the world. */
function act(
  agent: Agent,
  choice: PlanOutput | null,
  ended: Outcome | undefined,
  emit: Log,
): Action | null {
  const skill = choice ? agent.registry.get(choice.skill) : undefined;
  if (choice && skill) agent.executor.start(skill, choice.args, emit);
  return agent.executor.tick(ended, emit);
}

export function createKernel(setup: {
  readonly seed: number;
  readonly scenario: string;
  readonly world: WorldState;
  readonly rules: ActionRules;
  readonly agents: readonly AgentSetup[];
}): Kernel {
  const clock = createClock();
  const streams = createStreams(setup.seed);
  const trace = createTrace(setup.seed, setup.scenario);
  const agents = [...setup.agents].sort((a, b) => (a.id < b.id ? -1 : 1)).map(createAgent);
  let world = setup.world;
  let requests = new Map<EntityId, Action>();

  const tick = (): void => {
    const t = clock.tick();
    const events: TraceEvent[] = [];
    const emitFor =
      ({ id }: Agent): Log =>
      (type, data) =>
        events.push({ t, agent: id, type, data });

    const stepped = step(world, requests, setup.rules);
    world = stepped.state;
    const sensed = agents.map(({ id: self, setup: { sensors } }) => {
      const random = streams.stream(`sense:${self}`);
      return sensors.flatMap((sensor) => sensor({ t, world, self, random }));
    });
    agents.forEach((agent, i) => {
      takeIn(agent, sensed[i] ?? [], t, emitFor(agent));
    });
    for (const agent of agents) aim(agent, t, emitFor(agent));
    const choices = agents.map((agent) => plan(agent, emitFor(agent)));
    requests = new Map();
    agents.forEach((agent, i) => {
      const ended = stepped.outcomes.get(agent.id);
      const action = act(agent, choices[i] ?? null, ended, emitFor(agent));
      if (action) requests.set(agent.id, action);
    });
    for (const agent of agents) for (const learn of agent.setup.learners) learn(events);
    for (const event of events) trace.append(event);
  };

  return {
    trace,
    agents,
    get world() {
      return world;
    },
    tick,
  };
}
