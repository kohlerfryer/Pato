/** The duck's whole body: five actions, like the buttons on a controller. */

import type { EntityId } from "./fact.ts";

/** A place in the world that is not an entity. */
interface Spot {
  readonly x: number;
  readonly y: number;
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
