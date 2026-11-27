/** Checks a planner's choice before it runs, so a wrong or made-up choice never reaches the world. */

import type { PlanOutput } from "../planner/planner.ts";
import type { Belief } from "./belief.ts";
import { holds } from "./condition.ts";
import type { EntityId } from "./fact.ts";
import type { Registry } from "./registry.ts";
import { type Skill, matches } from "./skill.ts";

/** Whose choice it is, and what that agent knows and believes. */
interface Chooser {
  readonly registry: Registry;
  readonly belief: Belief;
  readonly self: EntityId;
}

function argsProblem(skill: Skill, args: PlanOutput["args"], belief: Belief): string | null {
  const extra = Object.keys(args).find((name) => !Object.hasOwn(skill.params, name));
  if (extra !== undefined) return `${skill.id} has no parameter called ${extra}`;
  for (const [name, query] of Object.entries(skill.params)) {
    const entity = args[name];
    if (entity === undefined) return `${skill.id} needs an argument for ${name}`;
    if (!matches(belief, entity, query))
      return `${entity} is not something ${skill.id} can take as ${name}`;
  }
  return null;
}

/** Why `choice` can't run, or null if it can. */
export function choiceProblem(
  choice: PlanOutput,
  { registry, belief, self }: Chooser,
): string | null {
  const skill = registry.get(choice.skill);
  if (!skill) return `no skill called ${choice.skill}`;
  const problem = argsProblem(skill, choice.args, belief);
  if (problem !== null) return problem;
  const unmet = skill.pre.find((condition) => !holds(condition, belief, { ...choice.args, self }));
  return unmet ? `${skill.id} needs ${unmet.predicate} to hold first` : null;
}
