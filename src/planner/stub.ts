/**
 * The stub planner: plain search, no model. It picks a skill whose effects satisfy the goal, and
 * when that skill's preconditions don't hold yet, works backward to one that makes them hold.
 */

import { type Belief, believing } from "../agent/belief.ts";
import { type Condition, holds, nameIn } from "../agent/condition.ts";
import type { EntityId } from "../agent/fact.ts";
import { matches } from "../agent/skill.ts";
import type { PlanInput, PlanOutput, Planner } from "./planner.ts";

/** How many preconditions deep it will chain before giving up. */
const MAX_DEPTH = 5;
const SELF = "self";

type Args = Readonly<Record<string, EntityId>>;
type SkillView = PlanInput["skills"][number];

interface Search {
  readonly self: EntityId;
  readonly belief: Belief;
  /** Skills in id order, so ties always break the same way. */
  readonly skills: readonly SkillView[];
  /** Everything the agent believes in, in id order. */
  readonly entities: readonly EntityId[];
}

/** Whether achieving `effect` is enough to achieve `goal`, going by their comparisons alone. */
function implies(effect: Condition, goal: Condition): boolean {
  if (effect.op !== goal.op) return false;
  if (effect.op === "is") return effect.value === goal.value;
  if (typeof effect.value !== "number" || typeof goal.value !== "number") return false;
  return effect.op === "below" ? effect.value <= goal.value : effect.value >= goal.value;
}

/** Fits one term of an effect to the entity the goal names there. Returns the arguments that make it fit. */
function fit(
  term: string | undefined,
  entity: string | undefined,
  args: Args,
  self: EntityId,
): Args | null {
  if (term === undefined || entity === undefined) return term === entity ? args : null;
  const name = nameIn(term);
  const stands = name === null ? term : name === SELF ? self : args[name];
  if (stands !== undefined) return stands === entity ? args : null;
  return name === null ? null : { ...args, [name]: entity };
}

/** The arguments under which `effect` achieves `goal`, or null if it can't. */
function unify(effect: Condition, goal: Condition, self: EntityId): Args | null {
  if (effect.predicate !== goal.predicate || !implies(effect, goal)) return null;
  const subject = fit(effect.subject, goal.subject, {}, self);
  return subject && fit(effect.object, goal.object, subject, self);
}

/** Every way to fill the skill's remaining parameters with things the agent believes in. */
function* completions(skill: SkillView, args: Args, search: Search): Generator<Args> {
  const open = Object.keys(skill.params).find((name) => args[name] === undefined);
  if (open === undefined) {
    const fits = Object.entries(args).every(([name, entity]) => {
      const query = skill.params[name];
      return query !== undefined && matches(search.belief, entity, query);
    });
    if (fits) yield args;
    return;
  }
  for (const entity of search.entities)
    yield* completions(skill, { ...args, [open]: entity }, search);
}

/** `condition` with every name replaced by what it stands for. */
function grounded(condition: Condition, names: Args): Condition {
  const stand = (term: string): string => names[nameIn(term) ?? ""] ?? term;
  const { object, ...rest } = condition;
  return {
    ...rest,
    subject: stand(condition.subject),
    ...(object === undefined ? {} : { object: stand(object) }),
  };
}

function choose(goal: Condition, search: Search, depth: number): PlanOutput | null {
  const { self, belief } = search;
  for (const skill of search.skills) {
    const options = skill.effects.flatMap((effect) => {
      const args = unify(effect, goal, self);
      return args ? [...completions(skill, args, search)] : [];
    });
    const unmet = (args: Args): Condition | undefined =>
      skill.pre.find((condition) => !holds(condition, belief, { ...args, [SELF]: self }));
    const ready = options.find((args) => unmet(args) === undefined);
    if (ready) return { skill: skill.id, args: ready };
    if (depth >= MAX_DEPTH) continue;
    for (const args of options) {
      const first = unmet(args);
      const earlier =
        first && choose(grounded(first, { ...args, [SELF]: self }), search, depth + 1);
      if (earlier) return earlier;
    }
  }
  return null;
}

/** A planner for the agent `self`. */
export function createStubPlanner(self: EntityId): Planner {
  return ({ goal, beliefs, skills }) => {
    const ids = beliefs.flatMap((fact) =>
      fact.object === undefined ? [fact.subject] : [fact.subject, fact.object],
    );
    const search: Search = {
      self,
      belief: believing(beliefs),
      skills: [...skills].sort((a, b) => (a.id < b.id ? -1 : 1)),
      entities: [...new Set(ids)].sort(),
    };
    return choose(grounded(goal, { [SELF]: self }), search, 0);
  };
}
