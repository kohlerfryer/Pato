/**
 * The planner's whole interface: what it is told and what it hands back. Any function of this
 * shape can be the brain, and the kernel checks its choice before anything runs.
 */

import type { Action } from "../agent/action.ts";
import type { Condition } from "../agent/condition.ts";
import type { EntityId, Fact } from "../agent/fact.ts";
import type { Skill } from "../agent/skill.ts";

/** Something the agent found out by trying: an action on a kind of thing, and what followed. */
export interface Note {
  readonly action: Action["kind"];
  /** The target's property, never an entity id. */
  readonly property: string;
  readonly effect: Condition;
  readonly tries: number;
  /** Recent success, from 0 to 1. */
  readonly score: number;
}

/** A skill as the planner sees it: what it needs and what it achieves, without how. */
type SkillView = Pick<Skill, "id" | "params" | "pre" | "effects">;

export interface PlanInput {
  readonly goal: Condition;
  readonly beliefs: readonly Fact[];
  readonly skills: readonly SkillView[];
  readonly notes: readonly Note[];
}

export interface PlanOutput {
  /** The id of a registered skill. */
  readonly skill: string;
  /** Which entity fills each of the skill's parameters. */
  readonly args: Readonly<Record<string, EntityId>>;
  /** What it expects to happen, shown as a thought bubble. */
  readonly guess?: string;
  /** What it tells a kid, also shown as a thought bubble. */
  readonly say?: string;
}

/** Chooses a skill for a goal, or nothing. */
export type Planner = (input: PlanInput) => PlanOutput | null;
