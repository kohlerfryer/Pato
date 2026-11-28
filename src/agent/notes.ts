/**
 * Notes: what the agent found out by trying things. Each says that an action on a thing with some
 * property was followed by some effect, how often it has been tried, and how reliably it followed.
 * A note names a property and never a thing, so what was learned on one thing holds for any like it.
 */

import type { Note } from "../planner/planner.ts";
import type { Condition } from "./condition.ts";
import type { EntityId, Fact } from "./fact.ts";

/** The effect noted when a try changed nothing, so the try still counts. */
export const NOTHING: Condition = { subject: "$self", predicate: "nothing", op: "is", value: true };
/** How many notes retrieval hands the planner. */
const RETRIEVED = 8;

/** One try: an action on a thing with `property`, and the effects seen to follow. */
export interface Tried {
  readonly action: Note["action"];
  readonly property: string;
  /** Written with `$thing` for the thing tried on and `$self` for the agent. */
  readonly effects: readonly Condition[];
}

const same = (a: Condition, b: Condition): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * `notes` after a try. Each note for the same action and property counts the try, and its score
 * moves toward 1 if its effect followed again and toward 0 if not: `s = (1 - a) * s + a * outcome`.
 * An effect never seen before gets a note of its own.
 */
export function record(notes: readonly Note[], tried: Tried, rate: number): Note[] {
  const effects = tried.effects.length > 0 ? tried.effects : [NOTHING];
  const updated = notes.map((note) => {
    if (note.action !== tried.action || note.property !== tried.property) return note;
    const outcome = effects.some((effect) => same(effect, note.effect)) ? 1 : 0;
    return { ...note, tries: note.tries + 1, score: (1 - rate) * note.score + rate * outcome };
  });
  const known = (effect: Condition): boolean =>
    notes.some(
      (note) =>
        note.action === tried.action &&
        note.property === tried.property &&
        same(note.effect, effect),
    );
  const fresh = effects
    .filter((effect) => !known(effect))
    .map((effect) => ({
      action: tried.action,
      property: tried.property,
      effect,
      tries: 1,
      score: 1,
    }));
  return [...updated, ...fresh];
}

/** How many times things with `property` have been tried: each action's count, added up. */
export function triesOn(notes: readonly Note[], property: string): number {
  const byAction = new Map<string, number>();
  for (const note of notes)
    if (note.property === property)
      byAction.set(note.action, Math.max(note.tries, byAction.get(note.action) ?? 0));
  return [...byAction.values()].reduce((sum, tries) => sum + tries, 0);
}

/**
 * The notes worth showing the planner: at most 8, those whose effect bears on the goal first, then
 * those about a property in view. Among equals, the order they were made in.
 */
export function retrieve(
  notes: readonly Note[],
  goal: Condition,
  visible: readonly string[],
): Note[] {
  const overlap = (note: Note): number =>
    (note.effect.predicate === goal.predicate ? 2 : 0) + (visible.includes(note.property) ? 1 : 0);
  return notes
    .map((note, order) => ({ note, order, rank: overlap(note) }))
    .sort((a, b) => b.rank - a.rank || a.order - b.order)
    .slice(0, RETRIEVED)
    .map(({ note }) => note);
}

/** What sight says each other thing in view is like: its properties, by thing. */
export function inView(facts: readonly Fact[], self: EntityId): ReadonlyMap<EntityId, string[]> {
  const things = new Map<EntityId, string[]>();
  for (const { subject, predicate, object, value, source } of facts)
    if (source === "sight" && subject !== self && object === undefined && value === true)
      things.set(subject, [...(things.get(subject) ?? []), predicate]);
  return things;
}
