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

  it("[S-DRAW-3] takes its bounds from where things are, with room around them", () => {
    expect(boundsOf(world, 2)).toEqual({ minX: -2, minY: -2, maxX: 12, maxY: 7 });
    expect(boundsOf(createWorld([]), 2)).toEqual({ minX: -2, minY: -2, maxX: 2, maxY: 2 });
  });
});

describe("viewModel", () => {
  it("[S-DRAW-2] gives each entity a shape, a position, a level and a label", () => {
    const { shapes } = viewModel({ world, events: [event("goal", { goal: hungry })], frame });
    expect(shapes).toEqual([
      { id: "food-1", shape: "box", x: 400, y: 0, width: 40, height: 20, level: 0, label: "food" },
      {
        id: "duck-1",
        shape: "circle",
        x: 200,
        y: 100,
        width: 20,
        height: 20,
        level: 1,
        label: "duck",
      },
    ]);
  });

  it("[S-DRAW-2] draws as a circle whatever acts, and as a box whatever doesn't", () => {
    const { shapes } = viewModel({ world, events: [], frame });
    expect(shapes.map(({ shape }) => shape)).toEqual(["box", "box"]);
  });

  it("[S-DRAW-2] gives each agent its goal and its thought, in words", () => {
    const events = [
      event("goal", { goal: hungry }),
      event("plan", { skill: "eat", args: { food: "food-1" } }),
    ];
    expect(viewModel({ world, events, frame }).agents).toEqual([
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
      events: [event("fact", { subject: "duck-1" })],
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
