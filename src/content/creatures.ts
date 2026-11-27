/** Creatures are data: one file each in `content/creatures/`. The weights in it are the personality. */

import { createRegistry } from "../agent/registry.ts";
import type { Skill } from "../agent/skill.ts";
import { fieldsProblem, isPositive, isRecord, readFiles } from "./check.ts";

/** A skill the creature is born with. The loader stamps where it came from. */
type Instinct = Omit<Skill, "origin">;

export interface CreatureDef {
  /** The file's name, without `.json`. */
  readonly id: string;
  /** Distance covered per second. */
  readonly speed: number;
  /** How close something must be to be used or grabbed. */
  readonly reach: number;
  /** How far it can see. */
  readonly sight: number;
  /** How much each drive matters to it. */
  readonly weights: Readonly<Record<string, number>>;
  /** How fast each of its needs grows, per second. */
  readonly rates: Readonly<Record<string, number>>;
  readonly instincts: readonly Instinct[];
}

const INSTINCT_FIELDS = ["id", "params", "pre", "effects", "body"];
const CREATURE_FIELDS = ["id", "speed", "reach", "sight", "weights", "rates", "instincts"];

const isAmounts = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((each) => typeof each === "number" && each >= 0);

function instinctProblem(value: unknown): string | null {
  if (!isRecord(value)) return "each instinct must be an object";
  const fields = fieldsProblem(value, INSTINCT_FIELDS);
  if (fields !== null) return `an instinct ${fields}`;
  const { params, pre, effects, body } = value;
  if (!isRecord(params) || ![pre, effects, body].every(Array.isArray))
    return "an instinct needs params as a map, and pre, effects and body as lists";
  return createRegistry().register({ ...(value as unknown as Instinct), origin: "instinct" });
}

function numbersProblem(value: Record<string, unknown>): string | null {
  const flat = ["speed", "reach", "sight"].find((name) => !isPositive(value[name]));
  if (flat !== undefined) return `${flat} must be a number above zero`;
  const amounts = ["weights", "rates"].find((name) => !isAmounts(value[name]));
  return amounts === undefined ? null : `${amounts} must map names to numbers of zero or more`;
}

function creatureProblem(value: unknown, stem: string): string | null {
  if (!isRecord(value)) return "must be an object";
  const fields = fieldsProblem(value, CREATURE_FIELDS) ?? numbersProblem(value);
  if (fields !== null) return fields;
  if (value.id !== stem) return `id must be "${stem}", the file's name`;
  if (!Array.isArray(value.instincts)) return "instincts must be a list";
  for (const instinct of value.instincts) {
    const problem = instinctProblem(instinct);
    if (problem !== null) return problem;
  }
  return null;
}

/** Checks each creature file. Throws on the first bad one, naming it. */
export function readCreatures(files: Readonly<Record<string, unknown>>): CreatureDef[] {
  return readFiles<CreatureDef>(files, creatureProblem);
}

/** Every creature in `content/creatures/`. */
export function loadCreatures(): CreatureDef[] {
  return readCreatures(
    import.meta.glob("../../content/creatures/*.json", { eager: true, import: "default" }),
  );
}

/** The skills a creature is born with. */
export function instinctsOf(creature: CreatureDef): Skill[] {
  return creature.instincts.map((instinct) => ({ ...instinct, origin: "instinct" }));
}
