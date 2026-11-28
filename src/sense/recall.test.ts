import { describe, expect, it } from "vitest";

import type { Fact } from "../agent/fact.ts";
import type { Sensor } from "../kernel/loop.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type Entity, type WorldState, createWorld } from "../world/state.ts";
import { remembering } from "./recall.ts";
import { createSight } from "./sight.ts";

const me = (x = 0): Entity => ({
  id: "a",
  position: { x, y: 0 },
  level: 0,
  props: { sight: 10, reach: 1 },
});
const snack: Entity = { id: "b", position: { x: 5, y: 0 }, level: 0, props: { kind: "snack" } };
const kinds = new Map([["snack", { looks: ["edible"] }]]);
const random = (): number => 0;
const minute = 60 * TICKS_PER_SECOND;

function looker(): (t: number, world: WorldState, self?: string) => Fact[] {
  const sense: Sensor = remembering(createSight(kinds, new Map()));
  return (t, world, self = "a") => [...sense({ t, world, self, random })];
}
const about = (facts: Fact[], subject = "b"): Fact[] => facts.filter((f) => f.subject === subject);

describe("remembering what went out of sight", () => {
  it("[S-SENSE-4] passes on what sight tells while the thing is in view", () => {
    const look = looker();
    const facts = look(1, createWorld([me(), snack]));
    expect(about(facts).every(({ source }) => source === "sight")).toBe(true);
  });

  it("[S-SENSE-4] keeps the last believed position of a thing that has left sight", () => {
    const look = looker();
    look(1, createWorld([me(), snack]));
    const later = about(look(2, createWorld([me(-20), snack])));
    expect(later.map(({ predicate, value }) => [predicate, value])).toEqual([
      ["edible", true],
      ["at", "5,0,0"],
    ]);
    expect(later.every(({ source, tEvent }) => source === "memory" && tEvent === 2)).toBe(true);
  });

  it("[S-SENSE-4] grows less sure of it as time passes: half as sure after a minute", () => {
    const look = looker();
    look(1, createWorld([me(), snack]));
    const sure = (t: number): number =>
      about(look(t, createWorld([me(-20), snack])))[0]?.confidence ?? 0;
    expect(sure(2)).toBeLessThan(1);
    expect(sure(1 + minute)).toBeCloseTo(0.5, 6);
    expect(sure(1 + 2 * minute)).toBeCloseTo(0.25, 6);
  });

  it("[S-SENSE-4] lets go of it once it is barely believed", () => {
    const look = looker();
    look(1, createWorld([me(), snack]));
    expect(about(look(1 + 4 * minute, createWorld([me(-20), snack])))).toEqual([]);
  });

  it("[S-SENSE-4] forgets it on coming within reach of where it was and not finding it", () => {
    const look = looker();
    look(1, createWorld([me(), snack]));
    expect(about(look(2, createWorld([me(-20)])))).toHaveLength(2);
    expect(about(look(3, createWorld([me(4.5)])))).toEqual([]);
    expect(about(look(4, createWorld([me(-20)])))).toEqual([]);
  });

  it("[S-SENSE-4] keeps each agent's memories apart", () => {
    const look = looker();
    const other: Entity = { ...me(-20), id: "c" };
    look(1, createWorld([me(), other, snack]));
    expect(about(look(2, createWorld([me(-20), other, snack]), "c"))).toEqual([]);
  });

  it("[S-SENSE-4] does not remember how things stood to the agent, which changes as it moves", () => {
    const look = looker();
    look(1, createWorld([me(), snack]));
    const recalled = look(2, createWorld([me(-20), snack]));
    expect(
      recalled.filter(({ source }) => source === "memory").map(({ predicate }) => predicate),
    ).not.toContain("near");
  });
});
