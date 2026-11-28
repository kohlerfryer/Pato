import { describe, expect, it } from "vitest";

import { loadContent } from "../content/content.ts";
import { loadScenarios } from "../content/scenarios.ts";
import { createRun } from "../evals/run.ts";
import type { TraceEvent } from "../kernel/trace.ts";
import { type Entity, createWorld } from "../world/state.ts";
import { type Frame, boundsOf, fit, viewModel } from "./model.ts";

const duck: Entity = {
  id: "duck-1",
  position: { x: 0, y: 0 },
  level: 1,
  props: { kind: "duck", speed: 2 },
};
const food: Entity = {
  id: "food-1",
  position: { x: 10, y: 5 },
  level: 0,
  props: { kind: "food", width: 2, depth: 1 },
};
const world = createWorld([food, duck]);
const box = { id: "food-1", shape: "block", level: 0, label: "food", known: false };
const circle = { id: "duck-1", shape: "circle", level: 1, label: "duck", known: false };
const frame: Frame = {
  bounds: { minX: -10, minY: -5, maxX: 10, maxY: 5 },
  viewport: { width: 400, height: 200 },
};
const event = (
  type: TraceEvent["type"],
  data: TraceEvent["data"],
  agent = "duck-1",
): TraceEvent => ({
  t: 1,
  agent,
  type,
  data,
});
const hungry = { subject: "$self", predicate: "hunger", op: "below", value: 0.2 };

describe("fit", () => {
  it.each([
    ["landscape", { width: 800, height: 300 }],
    ["portrait", { width: 300, height: 800 }],
    ["square", { width: 500, height: 500 }],
  ])(
    "[S-DRAW-3] scales the world to fit a %s viewport, keeping its proportions",
    (_name, viewport) => {
      const { bounds } = frame;
      const place = fit({ bounds, viewport });
      const corners = [place(bounds.minX, bounds.minY), place(bounds.maxX, bounds.maxY)];
      for (const { x, y } of corners) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(viewport.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(viewport.height);
      }
      const [low, high] = corners;
      const wide = Math.abs((high?.x ?? 0) - (low?.x ?? 0)) / 20;
      const tall = Math.abs((high?.y ?? 0) - (low?.y ?? 0)) / 10;
      expect(wide).toBeCloseTo(tall, 10);
      expect(wide).toBeCloseTo(Math.min(viewport.width / 20, viewport.height / 10), 10);
    },
  );

  it("[S-DRAW-3] centres the world and puts up at the top", () => {
    const place = fit({ ...frame, viewport: { width: 400, height: 400 } });
    expect(place(0, 0)).toEqual({ x: 200, y: 200, scale: 20 });
    expect(place(0, 5).y).toBe(100);
    expect(place(-10, 0).x).toBe(0);
  });

  it("[S-DRAW-3] takes its bounds from where things appear at an angle, with room around them", () => {
    expect(boundsOf(world, 2)).toEqual({ minX: -2, minY: -2, maxX: 12, maxY: 5 });
    expect(boundsOf(createWorld([]), 2)).toEqual({ minX: -2, minY: -2, maxX: 2, maxY: 2 });
  });
});

describe("viewModel", () => {
  it("[S-DRAW-2] sees the ground at an angle: farther is higher and squashed, and a level lifts", () => {
    const { shapes } = viewModel({ world, events: [event("goal", { goal: hungry })], frame });
    expect(shapes).toEqual([
      { ...box, x: 400, y: 50, width: 40, height: 10, tall: 10 },
      { ...circle, x: 200, y: 80, width: 20, height: 10, tall: 10 },
    ]);
  });

  it("[S-DRAW-2] lifts a thing by one unit for each level it is on", () => {
    const grounded = createWorld([food, { ...duck, level: 0 }]);
    const [, low] = viewModel({ world: grounded, events: [], frame }).shapes;
    const [, high] = viewModel({ world, events: [], frame }).shapes;
    expect((low?.y ?? 0) - (high?.y ?? 0)).toBe(20);
    expect(low?.x).toBe(high?.x);
  });

  it("[S-DRAW-2] draws a thing as tall as its height in levels, and a flat thing a little tall", () => {
    const house: Entity = { ...food, id: "house-1", props: { ...food.props, height: 2 } };
    const [tall, flat] = viewModel({ world: createWorld([house, food]), events: [], frame }).shapes;
    expect(tall?.tall).toBe(40);
    expect(flat?.tall).toBe(10);
    expect(boundsOf(createWorld([house]), 0).maxY).toBe(4.5);
  });

  it("[S-DRAW-2] lists shapes from far to near, so nearer things are drawn over farther ones", () => {
    const behind: Entity = { ...food, id: "food-2", position: { x: 0, y: 8 } };
    const front: Entity = { ...food, id: "food-3", position: { x: 0, y: -8 } };
    const mixed = createWorld([front, duck, behind, food]);
    const ids = viewModel({ world: mixed, events: [], frame }).shapes.map(({ id }) => id);
    expect(ids).toEqual(["food-2", "food-1", "duck-1", "food-3"]);
  });

  it("[S-DRAW-2] draws as a circle whatever acts, and as a box whatever doesn't", () => {
    const { shapes } = viewModel({ world, events: [], frame });
    expect(shapes.map(({ shape }) => shape)).toEqual(["block", "block"]);
  });

  it("[S-DRAW-2] gives each agent its goal and its thought, in words", () => {
    const events = [
      event("goal", { goal: hungry }),
      event("plan", { skill: "eat", args: { food: "food-1" } }),
    ];
    expect(viewModel({ world, events, frame }).agents).toMatchObject([
      { id: "duck-1", goal: "hunger below 0.2", thought: "eat food-1" },
    ]);
  });

  it("[S-DRAW-2] prefers what the planner said or guessed as the thought", () => {
    const guess = event("plan", { skill: "eat", args: {}, guess: "this looks tasty" });
    const say = event("plan", { skill: "eat", args: {}, guess: "hm", say: "can I have a box?" });
    expect(viewModel({ world, events: [guess], frame }).agents[0]?.thought).toBe(
      "this looks tasty",
    );
    expect(viewModel({ world, events: [guess, say], frame }).agents[0]?.thought).toBe(
      "can I have a box?",
    );
  });

  it("[S-DRAW-2] carries goal and thought forward from the view before", () => {
    const first = viewModel({ world, events: [event("goal", { goal: hungry })], frame });
    const second = viewModel({
      world,
      events: [event("learn", {})],
      frame,
      previous: first,
    });
    expect(second.agents).toEqual(first.agents);
    expect(second.shapes[1]?.shape).toBe("circle");
  });

  it("[S-DRAW-2] shows no goal once the agent wants nothing, and names relations by their object", () => {
    const near = { subject: "$self", predicate: "near", object: "food-1", op: "is", value: true };
    const wanted = viewModel({ world, events: [event("goal", { goal: near })], frame });
    expect(wanted.agents[0]?.goal).toBe("near food-1 is true");
    const calm = viewModel({
      world,
      events: [event("goal", { goal: null })],
      frame,
      previous: wanted,
    });
    expect(calm.agents[0]?.goal).toBeNull();
  });

  it("[S-DRAW-2] lists agents in id order and ignores events about the world itself", () => {
    const events = [
      event("goal", { goal: null }, "b"),
      event("goal", { goal: null }, "a"),
      { t: 1, agent: null, type: "world", data: {} } satisfies TraceEvent,
    ];
    expect(viewModel({ world, events, frame }).agents.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});

describe("what an agent can see", () => {
  const watcher: Entity = { ...duck, props: { ...duck.props, sight: 4 } };
  const watched = createWorld([food, watcher]);
  const acts = event("goal", { goal: hungry });
  const sees = (data: TraceEvent["data"]): TraceEvent =>
    event("fact", { source: "sight", ...data });
  const known = (events: TraceEvent[]): string[] =>
    viewModel({ world: watched, events, frame })
      .shapes.filter((shape) => shape.known)
      .map(({ id }) => id);

  it("[S-INSPECT-2] marks how far each agent can see, as a ring on the ground around it", () => {
    const { sights } = viewModel({ world: watched, events: [acts], frame });
    expect(sights).toEqual([{ id: "duck-1", x: 200, y: 80, width: 160, height: 80 }]);
  });

  it("[S-INSPECT-2] marks no ring around a thing that does not act, or an agent that cannot see", () => {
    expect(viewModel({ world: watched, events: [], frame }).sights).toEqual([]);
    expect(viewModel({ world, events: [acts], frame }).sights).toEqual([]);
  });

  it("[S-INSPECT-2] marks the entities an agent believes something about", () => {
    expect(known([acts])).toEqual([]);
    expect(known([sees({ subject: "food-1", predicate: "edible", value: true })])).toEqual([
      "food-1",
    ]);
    const near = sees({ subject: "duck-1", predicate: "near", object: "food-1", value: false });
    expect(known([near])).toEqual(["food-1"]);
  });

  it("[S-INSPECT-2] does not mark an agent for what it believes about itself", () => {
    expect(known([sees({ subject: "duck-1", predicate: "hunger", value: 0.4 })])).toEqual([]);
  });

  it("[S-INSPECT-2] stops marking an entity once everything about it is forgotten", () => {
    const seen = sees({ subject: "food-1", predicate: "edible", value: true });
    const gone = event("fact", { subject: "food-1", predicate: "edible", forgotten: true });
    expect(known([seen, gone])).toEqual([]);
  });
});

describe("watching", () => {
  const [scenario] = loadScenarios();
  const run = (watched: boolean): string => {
    if (!scenario) throw new Error("there is no scenario to run");
    const { kernel } = createRun(scenario, loadContent(), 1);
    const bounds = boundsOf(kernel.world, 2);
    let seen = 0;
    let view;
    for (let i = 0; i < 600; i++) {
      kernel.tick();
      if (!watched) continue;
      const events = kernel.trace.events.slice(seen);
      seen = kernel.trace.events.length;
      view = viewModel({
        world: kernel.world,
        events,
        frame: { bounds, viewport: { width: 390, height: 700 } },
        ...(view ? { previous: view } : {}),
      });
    }
    return kernel.trace.text();
  };

  it("[S-DRAW-1] a run with the viewer attached produces the same trace as a run without it", () => {
    expect(run(true)).toBe(run(false));
  });
});
