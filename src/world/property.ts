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
    strength: Strength,
  ) => ReturnType<ActionRule>;
  /** Whether an object with this property, at this value, hides what is behind it. */
  readonly blocksSight?: (strength: Strength) => boolean;
  /** Whether it can be picked up. */
  readonly canGrab?: (strength: Strength) => boolean;
  /** Whether its top can be stood on. */
  readonly canStandOn?: (strength: Strength) => boolean;
  /** Whether it can be walked into. */
  readonly canEnter?: (strength: Strength) => boolean;
  /** Whether being inside it, or holding it, keeps the rain off. */
  readonly keepsRainOff?: (strength: Strength) => boolean;
}

type Strength = boolean | number | string;
type Affordance = "canGrab" | "canStandOn" | "canEnter" | "keepsRainOff";

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

const ALL = propertyRules();

/** Whether any of `entity`'s properties, by its rule, makes `what` possible. */
export function affords(entity: Entity, what: Affordance): boolean {
  return Object.entries(entity.props).some(([name, strength]) => ALL.get(name)?.[what]?.(strength));
}
