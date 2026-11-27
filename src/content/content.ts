/** Everything in `content/` that a run is built from. */

import { type CreatureDef, loadCreatures } from "./creatures.ts";
import { type ObjectDef, loadObjects } from "./objects.ts";
import { loadVocabulary } from "./vocabulary.ts";

export interface Content {
  readonly objects: readonly ObjectDef[];
  readonly creatures: readonly CreatureDef[];
  readonly words: ReturnType<typeof loadVocabulary>;
}

export function loadContent(): Content {
  return { objects: loadObjects(), creatures: loadCreatures(), words: loadVocabulary() };
}
