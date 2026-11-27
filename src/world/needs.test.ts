import { describe, expect, it } from "vitest";

import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { type Entity, createWorld } from "./state.ts";
import { step } from "./step.ts";

const creature = (props: Entity["props"]): Entity => ({
  id: "a",
  position: { x: 0, y: 0 },
  level: 0,
  props,
});

const after = (ticks: number, props: Entity["props"]): Entity["props"] => {
  let world = createWorld([creature(props)]);
  for (let i = 0; i < ticks; i++) world = step(world, new Map(), {}).state;
  return world.entities[0]?.props ?? {};
};

describe("needs", () => {
  it("[S-WORLD-2] rise each tick at the creature's rate per second", () => {
    const props = after(TICKS_PER_SECOND, { hunger: 0.3, hunger_rate: 0.06 });
    expect(props.hunger).toBeCloseTo(0.36, 10);
  });

  it("[S-WORLD-2] each rise at their own rate", () => {
    const props = after(TICKS_PER_SECOND * 2, {
      hunger: 0.1,
      hunger_rate: 0.05,
      sleepiness: 0.2,
      sleepiness_rate: 0.01,
    });
    expect(props.hunger).toBeCloseTo(0.2, 10);
    expect(props.sleepiness).toBeCloseTo(0.22, 10);
  });

  it("[S-WORLD-2] never exceed 1", () => {
    expect(after(TICKS_PER_SECOND * 5, { hunger: 0.9, hunger_rate: 0.5 }).hunger).toBe(1);
  });

  it("[S-WORLD-2] start from zero when the creature has a rate but no level yet", () => {
    expect(after(TICKS_PER_SECOND, { hunger_rate: 0.3 }).hunger).toBeCloseTo(0.3, 10);
  });

  it("[S-WORLD-2] leave alone whatever has no rate", () => {
    expect(after(10, { hunger: 0.3, soft: 0.1 })).toEqual({ hunger: 0.3, soft: 0.1 });
  });
});
