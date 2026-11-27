/** The skills one agent has, by id. */

import { isActionKind } from "./action.ts";
import { nameIn } from "./condition.ts";
import type { Skill } from "./skill.ts";

export interface Registry {
  /** Adds `skill`. Returns why it was turned away, or null if it was taken. */
  register(skill: Skill): string | null;
  get(id: string): Skill | undefined;
  /** Every skill, in the order registered. */
  list(): readonly Skill[];
}

/** Why one step of a skill's body can't be run, or null if it can. */
function stepProblem(step: unknown, params: Skill["params"]): string | null {
  const { kind, target } = step as { kind?: unknown; target?: unknown };
  if (!isActionKind(kind)) return `"${String(kind)}" is not an action`;
  if (target === undefined) return null;
  const name = typeof target === "string" ? nameIn(target) : null;
  if (name === null || !Object.hasOwn(params, name))
    return `target ${JSON.stringify(target)} must name one of its parameters`;
  return null;
}

/** A body may hold only the five actions, aimed at the skill's own parameters. */
function bodyProblem({ id, body, params }: Skill): string | null {
  for (const step of body) {
    const problem = stepProblem(step, params);
    if (problem !== null) return `skill ${id}: ${problem}`;
  }
  return null;
}

export function createRegistry(): Registry {
  const skills = new Map<string, Skill>();
  return {
    register(skill) {
      const problem = bodyProblem(skill);
      if (problem === null) skills.set(skill.id, skill);
      return problem;
    },
    get: (id) => skills.get(id),
    list: () => [...skills.values()],
  };
}
