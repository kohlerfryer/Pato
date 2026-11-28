/**
 * What the stub planner knows about trying things. A skill with no effects, one parameter, and a
 * body that ends in an action is a way to try that action on a thing. Notes say what such tries
 * did, so each note is also a way to get its effect from anything with its property.
 */

import type { Action } from "../agent/action.ts";
import type { Condition } from "../agent/condition.ts";
import type { EntityId } from "../agent/fact.ts";
import { NOTHING, inView } from "../agent/notes.ts";
import type { Note, PlanInput, PlanOutput } from "./planner.ts";

type SkillView = PlanInput["skills"][number];
type Kind = Action["kind"];

/** The order actions are tried in: doing something with a thing before going to it. */
const ORDER: readonly Kind[] = ["use", "grab", "jump", "move_to"];
const THING = "$thing";

interface Tryer {
  readonly skill: SkillView;
  /** The parameter the thing tried on fills. */
  readonly param: string;
}

/** The first skill, by id, that tries each action. */
function tryers(skills: readonly SkillView[]): ReadonlyMap<Kind, Tryer> {
  const found = new Map<Kind, Tryer>();
  for (const skill of [...skills].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const [param, ...more] = Object.keys(skill.params);
    const last = skill.body.at(-1);
    if (skill.effects.length > 0 || param === undefined || more.length > 0 || !last) continue;
    if (!found.has(last.kind)) found.set(last.kind, { skill, param });
  }
  return found;
}

const words = ({ subject, predicate, object, op, value }: Condition): string =>
  [subject === "$self" ? undefined : subject, predicate, object, op, String(value)]
    .filter((part) => part !== undefined)
    .join(" ");

/** What `action` did to something else, by the best note about it. */
function hunch(action: Kind, notes: readonly Note[]): string {
  const best = notes
    .filter((note) => note.action === action && note.effect.predicate !== NOTHING.predicate)
    .sort((a, b) => b.score - a.score)[0];
  return best ? `maybe ${words(best.effect)}` : "no idea";
}

/**
 * An action not yet tried on a property in view, as a skill to run, or null if none is left. A try
 * counts once it has a note, or once it has been proposed, which `proposed` remembers: the notes
 * shown may not include every try.
 */
export function explore(
  { beliefs, notes, skills }: Pick<PlanInput, "beliefs" | "notes" | "skills">,
  self: EntityId,
  proposed: Set<string>,
): PlanOutput | null {
  const ways = tryers(skills);
  const tried = (action: Kind, property: string): boolean =>
    proposed.has(`${action} ${property}`) ||
    notes.some((note) => note.action === action && note.property === property);
  const things = [...inView(beliefs, self)].sort(([a], [b]) => (a < b ? -1 : 1));
  const options = things.flatMap(([thing, properties]) =>
    [...properties]
      .sort()
      .flatMap((property) => ORDER.map((action) => ({ thing, property, action }))),
  );
  for (const { thing, property, action } of options) {
    const way = ways.get(action);
    if (!way || tried(action, property)) continue;
    const guess = `${action} the ${property} thing: ${hunch(action, notes)}`;
    proposed.add(`${action} ${property}`);
    return { skill: way.skill.id, args: { [way.param]: thing }, guess };
  }
  return null;
}

/** Each note that says something happened, as a skill: try its action on anything with its property. */
export function noteSkills(notes: readonly Note[], skills: readonly SkillView[]): SkillView[] {
  const ways = tryers(skills);
  return notes.flatMap((note) => {
    const way = ways.get(note.action);
    if (!way || note.effect.predicate === NOTHING.predicate) return [];
    const named = (term: string | undefined): string | undefined =>
      term === THING ? `$${way.param}` : term;
    const object = named(note.effect.object);
    const effect = {
      ...note.effect,
      subject: named(note.effect.subject) ?? note.effect.subject,
      ...(object === undefined ? {} : { object }),
    };
    return [{ ...way.skill, params: { [way.param]: { has: [note.property] } }, effects: [effect] }];
  });
}
