/** The duck's whole body: five actions, like the buttons on a controller. */

import type { EntityId } from "./fact.ts";

/** A place along the ground that is not an entity. */
interface Spot {
  readonly x: number;
}

export type Action =
  | { readonly kind: "move_to"; readonly target: EntityId | Spot }
  | { readonly kind: "jump" }
  | { readonly kind: "grab"; readonly target: EntityId }
  | { readonly kind: "drop" }
  | { readonly kind: "use"; readonly target?: EntityId };

/** How an action ended. Anything but `done` says why. */
export type Outcome =
  | { readonly status: "done" }
  | { readonly status: "failed" | "interrupted"; readonly reason: string };

const KINDS: ReadonlySet<string> = new Set<Action["kind"]>([
  "move_to",
  "jump",
  "grab",
  "drop",
  "use",
]);

/** Whether `kind` is one of the five actions. */
export function isActionKind(kind: unknown): kind is Action["kind"] {
  return typeof kind === "string" && KINDS.has(kind);
}
