/** Scenarios are data: what the world starts with, what happens when, how long it runs, and with which seeds. */

import { fieldsProblem, isPositive, isRecord, readFiles } from "./check.ts";

/** Something of a kind, at a spot given as [x, y]. */
interface Placement {
  readonly kind: string;
  /** How far along the ground. */
  readonly at: number;
}

export interface Scenario {
  /** The file's name, without `.json`. */
  readonly id: string;
  /** How long it runs, in simulated seconds. */
  readonly horizon_s: number;
  /** One run is made for each seed. */
  readonly seeds: readonly number[];
  /** How long something used up stays away. Zero means it never comes back. */
  readonly respawn_s: number;
  readonly setup: {
    readonly objects: readonly Placement[];
    readonly agents: readonly {
      readonly creature: string;
      readonly at: number;
      /** The levels its needs start at. */
      readonly state: Readonly<Record<string, number>>;
    }[];
  };
  /** Things that appear partway through. */
  readonly triggers: readonly { readonly at_s: number; readonly spawn: Placement }[];
}

const FIELDS = ["id", "horizon_s", "seeds", "respawn_s", "setup", "triggers"];

const isSpot = (value: unknown): boolean => typeof value === "number";

const isNumbers = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((each) => typeof each === "number");

const isPlacement = (value: unknown): boolean =>
  isRecord(value) &&
  fieldsProblem(value, ["kind", "at"]) === null &&
  typeof value.kind === "string" &&
  isSpot(value.at);

const isAgent = (value: unknown): boolean =>
  isRecord(value) &&
  fieldsProblem(value, ["creature", "at", "state"]) === null &&
  typeof value.creature === "string" &&
  isSpot(value.at) &&
  isNumbers(value.state);

const isTrigger = (value: unknown): boolean =>
  isRecord(value) &&
  fieldsProblem(value, ["at_s", "spawn"]) === null &&
  typeof value.at_s === "number" &&
  value.at_s >= 0 &&
  isPlacement(value.spawn);

const isListOf = (value: unknown, each: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(each);

function setupProblem(setup: unknown): string | null {
  if (!isRecord(setup) || fieldsProblem(setup, ["objects", "agents"]) !== null)
    return "setup needs objects and agents";
  if (!isListOf(setup.objects, isPlacement)) return "each object needs a kind and a spot";
  if (!isListOf(setup.agents, isAgent)) return "each agent needs a creature, a spot and a state";
  return null;
}

function timingProblem(value: Record<string, unknown>): string | null {
  if (!isPositive(value.horizon_s)) return "horizon_s must be above zero";
  const { seeds, respawn_s: respawn } = value;
  if (!Array.isArray(seeds) || seeds.length === 0 || !seeds.every(Number.isInteger))
    return "seeds must be a list of whole numbers, with at least one";
  if (typeof respawn !== "number" || respawn < 0) return "respawn_s must be zero or more";
  return null;
}

function scenarioProblem(value: unknown, stem: string): string | null {
  if (!isRecord(value)) return "must be an object";
  const fields = fieldsProblem(value, FIELDS);
  if (fields !== null) return fields;
  if (value.id !== stem) return `id must be "${stem}", the file's name`;
  if (!isListOf(value.triggers, isTrigger))
    return "each trigger needs a time and something to spawn";
  return timingProblem(value) ?? setupProblem(value.setup);
}

/** Checks each scenario file. Throws on the first bad one, naming it. */
export function readScenarios(files: Readonly<Record<string, unknown>>): Scenario[] {
  return readFiles<Scenario>(files, scenarioProblem);
}

/** Every scenario in `content/scenarios/`, in name order. */
export function loadScenarios(): Scenario[] {
  return readScenarios(
    import.meta.glob("../../content/scenarios/*.json", { eager: true, import: "default" }),
  );
}
