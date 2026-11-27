import { describe, expect, it } from "vitest";

import { type Entity, createWorld } from "../world/state.ts";
import { createBody } from "./body.ts";

const me = (props: Entity["props"], level = 0): Entity => ({
  id: "a",
  position: { x: 0, y: 0 },
  level,
  props,
});
const body = createBody({
  states: ["hunger", "sleepiness", "wet", "level"],
  relations: ["holding"],
});
const random = (): number => 0;
const feel = (entity: Entity, t = 3): unknown[] =>
  body({ t, world: createWorld([entity]), self: "a", random }).map(
    ({ subject, predicate, object, value }) => ({ subject, predicate, object, value }),
  );

describe("body sense", () => {
  it("[S-SENSE-2] tells the agent's own hunger, sleepiness, wet, holding and level", () => {
    const facts = feel(me({ hunger: 0.4, sleepiness: 0.1, wet: true, holding: "b", speed: 2 }, 1));
    expect(facts).toEqual([
      { subject: "a", predicate: "hunger", object: undefined, value: 0.4 },
      { subject: "a", predicate: "sleepiness", object: undefined, value: 0.1 },
      { subject: "a", predicate: "wet", object: undefined, value: true },
      { subject: "a", predicate: "level", object: undefined, value: 1 },
      { subject: "a", predicate: "holding", object: "b", value: true },
    ]);
  });

  it("[S-SENSE-2] tells them every tick, stamped with the tick", () => {
    const first = body({ t: 1, world: createWorld([me({ hunger: 0.4 })]), self: "a", random });
    const second = body({ t: 2, world: createWorld([me({ hunger: 0.5 })]), self: "a", random });
    expect(first.map((fact) => fact.tEvent)).toEqual([1, 1]);
    expect(second.find((fact) => fact.predicate === "hunger")).toMatchObject({
      value: 0.5,
      tEvent: 2,
      source: "body",
      confidence: 1,
    });
  });

  it("[S-SENSE-2] leaves out a state the agent doesn't have", () => {
    expect(feel(me({ hunger: 0.4 }))).toHaveLength(2);
  });

  it("[S-SENSE-2] says nothing is held when nothing is", () => {
    const predicates = feel(me({ hunger: 0.4 })).map(
      (fact) => (fact as { predicate: string }).predicate,
    );
    expect(predicates).not.toContain("holding");
  });

  it("[S-SENSE-2] tells nothing when the agent is not in the world", () => {
    expect(body({ t: 1, world: createWorld([]), self: "a", random })).toEqual([]);
  });
});
