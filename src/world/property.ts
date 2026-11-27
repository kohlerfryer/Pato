/**
 * What a property makes possible. Each property has one rule module in `rules/`, named after it,
 * and that module is the only place the property is given an effect.
 */

import type { Entity, WorldState } from "./state.ts";
import type { ActionRule } from "./step.ts";

export interface PropertyRule {
  /** What happens when `actor` uses `object`. `strength` is the value the object has for this property. */
  readonly use?: (
    state: WorldState,
    actor: Entity,
    object: Entity,
    strength: boolean | number | string,
  ) => ReturnType<ActionRule>;
}

/** Every property's rule, by property name. Adding a module to `rules/` is all it takes to add one. */
export function propertyRules(): ReadonlyMap<string, PropertyRule> {
  const modules = import.meta.glob("./rules/*.ts", { eager: true, import: "default" });
  return new Map(
    Object.keys(modules)
      .sort()
      .map((path) => {
        const name = (path.split("/").at(-1) ?? path).replace(/\.ts$/, "");
        return [name, modules[path] as PropertyRule];
      }),
  );
}
