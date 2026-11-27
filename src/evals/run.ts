/** Turns a scenario file into a running world: entities placed, agents wired up, triggers timed. */

import { createArbiter, needDrive, urgencies } from "../agent/drives.ts";
import type { Content } from "../content/content.ts";
import { type CreatureDef, instinctsOf } from "../content/creatures.ts";
import type { ObjectDef } from "../content/objects.ts";
import type { Scenario } from "../content/scenarios.ts";
import { knownPredicates } from "../content/vocabulary.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type AgentSetup, type Kernel, type Sensor, createKernel } from "../kernel/loop.ts";
import type { Trace } from "../kernel/trace.ts";
import { createStubPlanner } from "../planner/stub.ts";
import { createBody } from "../sense/body.ts";
import { createSight } from "../sense/sight.ts";
import { actionRules } from "../world/actions.ts";
import { propertyRules } from "../world/property.ts";
import { type Entity, createWorld } from "../world/state.ts";

interface Run {
  readonly kernel: Kernel;
  /** How many ticks the scenario runs for. */
  readonly ticks: number;
}

type Spot = readonly [number, number];

const ticksIn = (seconds: number): number => Math.round(seconds * TICKS_PER_SECOND);

/** Hands out ids by kind: the first food is `food-1`, the next `food-2`. */
function numberer(): (kind: string) => string {
  const counts = new Map<string, number>();
  return (kind) => {
    const n = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, n);
    return `${kind}-${String(n)}`;
  };
}

/** Finds the file a scenario names, or stops the run saying which one is missing. */
function named<T extends { readonly id: string }>(
  defs: readonly T[],
  id: string,
  scenario: Scenario,
): T {
  const def = defs.find((each) => each.id === id);
  if (!def) throw new Error(`scenario ${scenario.id}: there is no file for "${id}"`);
  return def;
}

const objectEntity = (def: ObjectDef, id: string, [x, y]: Spot): Entity => ({
  id,
  position: { x, y },
  level: 0,
  props: { ...def.props, kind: def.id, width: def.footprint.width, depth: def.footprint.depth },
});

function creatureEntity(
  def: CreatureDef,
  id: string,
  [x, y]: Spot,
  state: Entity["props"],
): Entity {
  const rates = Object.entries(def.rates).map(([need, rate]) => [`${need}_rate`, rate] as const);
  const { speed, reach, sight } = def;
  return {
    id,
    position: { x, y },
    level: 0,
    props: { kind: def.id, speed, reach, sight, ...state, ...Object.fromEntries(rates) },
  };
}

function agentSetup(id: string, def: CreatureDef, sensors: readonly Sensor[]): AgentSetup {
  const drives = Object.keys(def.weights).map(needDrive);
  return {
    id,
    sensors,
    drives: createArbiter(drives, def.weights, id),
    urgencies: (belief) => urgencies(drives, def.weights, belief, id),
    planner: createStubPlanner(id),
    skills: instinctsOf(def),
    notes: [],
    learners: [],
  };
}

/** One run of `scenario` with `seed`, ready to tick. */
export function createRun(scenario: Scenario, content: Content, seed: number): Run {
  const { objects, creatures, words } = content;
  const name = numberer();
  const placed = (kind: string, at: Spot): Entity =>
    objectEntity(named(objects, kind, scenario), name(kind), at);
  const things = scenario.setup.objects.map(({ kind, at }) => placed(kind, at));
  const sensors = [
    createSight(new Map(objects.map((def) => [def.id, def])), propertyRules()),
    createBody({ states: Object.keys(words.states), relations: Object.keys(words.relations) }),
  ];
  const agents = scenario.setup.agents.map(({ creature, at, state }) => {
    const def = named(creatures, creature, scenario);
    const id = name(creature);
    return { entity: creatureEntity(def, id, at, state), setup: agentSetup(id, def, sensors) };
  });
  const arriving = new Map<number, Entity[]>();
  for (const { at_s: seconds, spawn } of scenario.triggers) {
    const due = Math.max(1, ticksIn(seconds));
    arriving.set(due, [...(arriving.get(due) ?? []), placed(spawn.kind, spawn.at)]);
  }
  const kernel = createKernel({
    seed,
    scenario: scenario.id,
    world: createWorld(
      [...things, ...agents.map(({ entity }) => entity)],
      ticksIn(scenario.respawn_s),
    ),
    rules: actionRules(),
    agents: agents.map(({ setup }) => setup),
    known: knownPredicates(words),
    arrivals: (t) => arriving.get(t) ?? [],
  });
  return { kernel, ticks: ticksIn(scenario.horizon_s) };
}

/** Runs `scenario` to its horizon once for each of its seeds, and returns the traces. */
export function runScenario(scenario: Scenario, content: Content): Trace[] {
  return scenario.seeds.map((seed) => {
    const { kernel, ticks } = createRun(scenario, content, seed);
    for (let i = 0; i < ticks; i++) kernel.tick();
    return kernel.trace;
  });
}
