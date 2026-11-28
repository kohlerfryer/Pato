/**
 * What using a thing does, as written in its object file: a list of steps, each one of a few
 * primitives. Set a fact about the thing, toggle one of its states, add or remove a property, or
 * change a drive of whoever uses it.
 */

import { type Entity, type WorldState, amount, withEntity } from "./state.ts";

type Plain = boolean | number | string;

export type UseStep =
  | { readonly set: Readonly<Record<string, Plain>> }
  | { readonly toggle: string }
  | { readonly add: string }
  | { readonly remove: string }
  | { readonly change: Readonly<Record<string, number>> };

const isRecordOf = (value: unknown, each: (item: unknown) => boolean): boolean =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(each);

const isPlain = (value: unknown): boolean => ["boolean", "number", "string"].includes(typeof value);

const CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = {
  set: (value) => isRecordOf(value, isPlain),
  toggle: (value) => typeof value === "string",
  add: (value) => typeof value === "string",
  remove: (value) => typeof value === "string",
  change: (value) => isRecordOf(value, (each) => typeof each === "number"),
};

/** Why `steps` is not a use made of the primitives, or null if it is. */
export function useProblem(steps: unknown): string | null {
  if (!Array.isArray(steps)) return "use must be a list of steps";
  for (const step of steps as unknown[]) {
    const entries: [string, unknown][] =
      typeof step === "object" && step !== null ? Object.entries(step) : [];
    const [only, ...more] = entries;
    const check = only ? CHECKS[only[0]] : undefined;
    if (!only || more.length > 0 || !check?.(only[1]))
      return "each step of use must be one of set, toggle, add, remove or change";
  }
  return null;
}

const without = (props: Entity["props"], name: string): Entity["props"] =>
  Object.fromEntries(Object.entries(props).filter(([key]) => key !== name));

/** `thing` after one step that changes it, or as it was. */
function changed(thing: Entity, step: UseStep): Entity {
  if ("set" in step) return { ...thing, props: { ...thing.props, ...step.set } };
  if ("toggle" in step)
    return {
      ...thing,
      props: { ...thing.props, [step.toggle]: thing.props[step.toggle] !== true },
    };
  if ("add" in step) return { ...thing, props: { ...thing.props, [step.add]: true } };
  if ("remove" in step) return { ...thing, props: without(thing.props, step.remove) };
  return thing;
}

/** The user after a step that changes its drives, each kept between 0 and 1. */
function moved(user: Entity, step: UseStep): Entity {
  if (!("change" in step)) return user;
  const levels = Object.entries(step.change).map(([name, by]): [string, number] => [
    name,
    Math.min(1, Math.max(0, amount(user, name) + by)),
  ]);
  return { ...user, props: { ...user.props, ...Object.fromEntries(levels) } };
}

/** `state` after `user` uses `thing`, one step at a time. */
export function applyUse(
  state: WorldState,
  user: Entity,
  thing: Entity,
  steps: readonly UseStep[],
): WorldState {
  let [nextUser, nextThing] = [user, thing];
  for (const step of steps)
    [nextUser, nextThing] = [moved(nextUser, step), changed(nextThing, step)];
  return withEntity(withEntity(state, nextThing), nextUser);
}
