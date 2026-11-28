import { describe, expect, it } from "vitest";

import type { Action } from "../agent/action.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { actionRules } from "./actions.ts";
import { type Entity, type WorldState, createWorld, find } from "./state.ts";
import { step } from "./step.ts";

const rules = actionRules();
const duck = (x = 0, props: Entity["props"] = {}): Entity => ({
  id: "a",
  position: { x, y: 0 },
  level: 0,
  props: { speed: 3, reach: 1, ...props },
});
const thing = (id: string, x: number, props: Entity["props"]): Entity => ({
  id,
  position: { x, y: 0 },
  level: 0,
  props: { width: 4, depth: 4, height: 2, ...props },
});
const house = thing("house", 6, { has_opening: true, roof: true });
const shed = thing("shed", 6, { has_opening: true });
const wall = thing("wall", 6, {});

function run(world: WorldState, action: Action | null, ticks: number): WorldState {
  let state = world;
  for (let i = 0; i < ticks; i++) {
    const requests = new Map(action ? [["a", action]] : []);
    state = step(state, requests, rules).state;
  }
  return state;
}
type Target = Extract<Action, { kind: "move_to" }>["target"];
const goTo = (target: Target): Action => ({ kind: "move_to", target });
const rainy = (world: WorldState): WorldState => ({ ...world, raining: true });
const self = (state: WorldState): Entity["props"] => find(state, "a")?.props ?? {};
/** `state` with the agent lifted to `x`, so time spent walking doesn't count. */
const at = (state: WorldState, x: number): WorldState => ({
  ...state,
  entities: state.entities.map((e) => (e.id === "a" ? { ...e, position: { x, y: 0 } } : e)),
});

describe("openings", () => {
  it("[S-WORLD-5] walks into a thing with an opening and is inside it", () => {
    const state = run(createWorld([duck(), house]), goTo("house"), 90);
    expect(find(state, "a")?.position.x).toBeCloseTo(6, 6);
    expect(self(state).inside).toBe("house");
  });

  it("[S-WORLD-5] is inside only while within its footprint", () => {
    const entered = run(createWorld([duck(), house]), goTo("house"), 90);
    const left = run(entered, goTo({ x: 12, y: 0 }), 90);
    expect(self(left).inside).toBeUndefined();
  });

  it("[S-WORLD-5] stops at the edge of a thing with no opening", () => {
    const world = createWorld([duck(), wall]);
    let state = world;
    let ended;
    for (let i = 0; i < 90 && ended === undefined; i++) {
      const stepped = step(state, new Map([["a", goTo({ x: 6, y: 0 })]]), rules);
      state = stepped.state;
      ended = stepped.outcomes.get("a");
    }
    expect(ended).toEqual({ status: "failed", reason: "blocked" });
    const x = find(state, "a")?.position.x ?? 0;
    expect(x).toBeLessThanOrEqual(4);
    expect(x).toBeGreaterThan(3.8);
  });

  it("[S-WORLD-5] walks over things that stand no levels tall, and past things on other levels, to within reach of its spot", () => {
    const rug = thing("rug", 6, { height: 0 });
    expect(
      find(run(createWorld([duck(), rug]), goTo({ x: 9, y: 0 }), 90), "a")?.position.x,
    ).toBeCloseTo(8);
    const shelf = { ...wall, level: 2 };
    expect(
      find(run(createWorld([duck(), shelf]), goTo({ x: 9, y: 0 }), 90), "a")?.position.x,
    ).toBeCloseTo(8);
  });
});

describe("cover", () => {
  it("[S-WORLD-6] is under cover inside a thing with a roof, and not inside one without", () => {
    expect(self(run(createWorld([duck(6), house]), null, 1)).under_cover).toBe(true);
    expect(self(run(createWorld([duck(6), shed]), null, 1)).under_cover).toBe(false);
    expect(self(run(createWorld([duck(0), house]), null, 1)).under_cover).toBe(false);
  });

  it("[S-WORLD-6] is under cover while holding a thing with a roof", () => {
    const brolly: Entity = { id: "u", position: { x: 0, y: 0 }, level: 0, props: { roof: true } };
    expect(self(run(createWorld([duck(0, { holding: "u" }), brolly]), null, 1)).under_cover).toBe(
      true,
    );
  });
});

describe("rain", () => {
  const fiveSeconds = 5 * TICKS_PER_SECOND;

  it("[S-WORLD-7] wets an agent out in the rain, and not one under cover", () => {
    expect(self(run(rainy(createWorld([duck()])), null, 1)).wet).toBe(true);
    expect(self(run(rainy(createWorld([duck(6), house])), null, 1)).wet).toBe(false);
    expect(self(run(createWorld([duck()]), null, 1)).wet).toBe(false);
  });

  it("[S-WORLD-7] stays wet out of the rain until it has been under cover for five seconds", () => {
    const soaked = run(rainy(createWorld([duck(), house])), null, 1);
    const stopped = run({ ...soaked, raining: false }, null, 60);
    expect(self(stopped).wet).toBe(true);
    const settled = run(at(stopped, 6), null, fiveSeconds - 1);
    expect(self(settled).wet).toBe(true);
    expect(self(run(settled, null, 1)).wet).toBe(false);
  });

  it("[S-WORLD-7] starts the five seconds again if it leaves cover before it is dry", () => {
    const soaked = run(rainy(createWorld([duck(), house])), null, 1);
    const dryWorld = { ...soaked, raining: false };
    const half = run(at(dryWorld, 6), null, fiveSeconds / 2);
    const out = run(at(half, 0), null, 1);
    expect(self(run(at(out, 6), null, fiveSeconds - 2)).wet).toBe(true);
  });

  it("[S-WORLD-7] wets only things that can move", () => {
    const state = run(rainy(createWorld([duck(), wall])), null, 1);
    expect(find(state, "wall")?.props.wet).toBeUndefined();
  });
});
