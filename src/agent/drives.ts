/**
 * Drives give an agent reasons of its own. Each measures a discomfort, and the creature's weight
 * for it says how much that discomfort matters. The most urgent one sets the goal.
 */

import type { Belief } from "./belief.ts";
import { type Condition, holds } from "./condition.ts";
import type { EntityId } from "./fact.ts";

interface Drive {
  readonly name: string;
  /** What would put it right. */
  readonly goal: Condition;
  /** How bad things are, given what the agent believes. Read as 0 to 1. */
  discomfort(belief: Belief, self: EntityId): number;
}

type Weights = Readonly<Record<string, number>>;

/** A need counts as met below this level. */
const SATISFIED = 0.2;
/** A challenger must be this much more urgent than the current drive to take over. */
const HYSTERESIS = 0.1;

/** A drive for a need the body reports as a level from 0 to 1, such as hunger. */
export function needDrive(state: string): Drive {
  return {
    name: state,
    goal: { subject: "$self", predicate: state, op: "below", value: SATISFIED },
    discomfort(belief, self) {
      const level = belief.get({ subject: self, predicate: state })?.value;
      return typeof level === "number" ? level : 0;
    },
  };
}

/** A drive against a state the body reports as true or false, such as being wet. */
export function dislikeDrive(state: string): Drive {
  return {
    name: state,
    goal: { subject: "$self", predicate: state, op: "is", value: false },
    discomfort(belief, self) {
      return belief.get({ subject: self, predicate: state })?.value === true ? 1 : 0;
    },
  };
}

/** Each drive's urgency: its discomfort, kept between 0 and 1, times the creature's weight for it. */
export function urgencies(
  drives: readonly Drive[],
  weights: Weights,
  belief: Belief,
  self: EntityId,
): Map<string, number> {
  return new Map(
    drives.map((drive) => {
      const discomfort = Math.min(1, Math.max(0, drive.discomfort(belief, self)));
      return [drive.name, (weights[drive.name] ?? 0) * discomfort];
    }),
  );
}

/**
 * Decides, tick by tick, what the agent wants. The most urgent unmet drive sets the goal, and the
 * current one keeps it until it is met or another is more urgent by the hysteresis margin.
 */
export function createArbiter(
  drives: readonly Drive[],
  weights: Weights,
  self: EntityId,
): (belief: Belief, t: number) => Condition | null {
  let current: string | null = null;
  return (belief) => {
    const urgency = urgencies(drives, weights, belief, self);
    const of = (drive: Drive): number => urgency.get(drive.name) ?? 0;
    const wanting = drives
      .filter((drive) => of(drive) > 0 && !holds(drive.goal, belief, { self }))
      .sort((a, b) => of(b) - of(a) || (a.name < b.name ? -1 : 1));
    const [top] = wanting;
    const held = wanting.find((drive) => drive.name === current);
    if (!top) {
      current = null;
      return null;
    }
    if (held && of(top) <= of(held) + HYSTERESIS) return held.goal;
    current = top.name;
    return top.goal;
  };
}
