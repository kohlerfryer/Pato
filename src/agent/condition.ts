/** A statement about belief that either holds or doesn't, such as "my hunger is below 0.2". */

import type { Belief } from "./belief.ts";
import type { EntityId, Fact } from "./fact.ts";

export interface Condition {
  /** An entity id, or a name to be filled in: `$self`, or a skill's parameter such as `$food`. */
  readonly subject: string;
  readonly predicate: string;
  /** The second entity of a relation, written the same way as the subject. */
  readonly object?: string;
  readonly op: "is" | "below" | "above";
  readonly value: boolean | number | string;
}

const NAME_MARK = "$";

/** The name a term asks to have filled in (`food` for `$food`), or null if it is a plain entity id. */
export function nameIn(term: string): string | null {
  return term.startsWith(NAME_MARK) ? term.slice(NAME_MARK.length) : null;
}

/** What each name stands for: `self`, and whatever fills a skill's parameters. */
type Names = Readonly<Record<string, EntityId>>;

function resolve(term: string, names: Names): EntityId | undefined {
  const name = nameIn(term);
  return name === null ? term : names[name];
}

function compare(held: Fact["value"], { op, value }: Condition): boolean {
  if (op === "is") return held === value;
  if (typeof held !== "number" || typeof value !== "number") return false;
  return op === "below" ? held < value : held > value;
}

/** Whether `condition` is true of what `belief` holds, once its names are filled in from `names`. */
export function holds(condition: Condition, belief: Belief, names: Names): boolean {
  const subject = resolve(condition.subject, names);
  if (subject === undefined) return false;
  if (condition.object === undefined)
    return compareHeld(belief.get({ subject, predicate: condition.predicate }), condition);
  const object = resolve(condition.object, names);
  if (object === undefined) return false;
  return compareHeld(belief.get({ subject, predicate: condition.predicate, object }), condition);
}

function compareHeld(held: Fact | undefined, condition: Condition): boolean {
  return held !== undefined && compare(held.value, condition);
}
