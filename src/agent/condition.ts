/** A statement about belief that either holds or doesn't, such as "my hunger is below 0.2". */

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
