/**
 * What to draw, as plain data. The page turns this into pixels and nothing else, so everything
 * worth testing about the picture is decided here.
 */

import type { TraceEvent } from "../kernel/trace.ts";
import { type WorldState, amount } from "../world/state.ts";

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The part of the world to show, and the size of the screen to show it on. */
export interface Frame {
  readonly bounds: Bounds;
  readonly viewport: { readonly width: number; readonly height: number };
}

interface Shape {
  readonly id: string;
  /** Whatever acts is a circle. Everything else is a box. */
  readonly shape: "circle" | "box";
  /** Its centre, in screen pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly level: number;
  readonly label: string;
}

interface AgentView {
  readonly id: string;
  /** What it wants, in words, or null when it wants nothing. */
  readonly goal: string | null;
  /** What it last decided, said or guessed. */
  readonly thought: string | null;
}

export interface ViewModel {
  readonly shapes: readonly Shape[];
  readonly agents: readonly AgentView[];
}

/** How big to draw something that has no footprint of its own, in world units. */
const DEFAULT_SIZE = 1;

/** The box around every entity's centre, with `margin` of room on each side. */
export function boundsOf(world: WorldState, margin: number): Bounds {
  const xs = world.entities.map((entity) => entity.position.x);
  const ys = world.entities.map((entity) => entity.position.y);
  return {
    minX: Math.min(0, ...xs) - margin,
    minY: Math.min(0, ...ys) - margin,
    maxX: Math.max(0, ...xs) + margin,
    maxY: Math.max(0, ...ys) + margin,
  };
}

/**
 * Places a world point on the screen: the whole frame fits, centred, at one scale for both axes,
 * with up at the top.
 */
export function fit({
  bounds,
  viewport,
}: Frame): (x: number, y: number) => { x: number; y: number; scale: number } {
  const wide = bounds.maxX - bounds.minX;
  const tall = bounds.maxY - bounds.minY;
  const scale = Math.min(viewport.width / wide, viewport.height / tall);
  const left = (viewport.width - wide * scale) / 2;
  const bottom = (viewport.height - tall * scale) / 2;
  return (x, y) => ({
    x: left + (x - bounds.minX) * scale,
    y: viewport.height - bottom - (y - bounds.minY) * scale,
    scale,
  });
}

/** A goal as the trace holds it, in words: "hunger below 0.2". */
function goalText(goal: unknown): string | null {
  if (typeof goal !== "object" || goal === null) return null;
  const { predicate, object, op, value } = goal as Record<string, unknown>;
  return [predicate, object, op, value]
    .filter((part) => part !== undefined)
    .map(String)
    .join(" ");
}

/** A plan as the trace holds it, in words: what was said or guessed, or else the skill chosen. */
function thoughtText(data: TraceEvent["data"]): string {
  const spoken = data.say ?? data.guess;
  if (typeof spoken === "string") return spoken;
  const args: unknown[] =
    typeof data.args === "object" && data.args !== null ? Object.values(data.args) : [];
  return [data.skill, ...args].map(String).join(" ");
}

/** Each agent's goal and thought, brought up to date with `events`. */
function follow(previous: readonly AgentView[], events: readonly TraceEvent[]): AgentView[] {
  const agents = new Map(previous.map((agent) => [agent.id, agent]));
  for (const { agent: id, type, data } of events) {
    if (id === null) continue;
    const known = agents.get(id) ?? { id, goal: null, thought: null };
    const goal = type === "goal" ? goalText(data.goal) : known.goal;
    const decided = type === "plan" && data.invalid === undefined;
    agents.set(id, { id, goal, thought: decided ? thoughtText(data) : known.thought });
  }
  return [...agents.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The picture for one moment: the world as it stands, and what `events` add to the view before. */
export function viewModel(input: {
  readonly world: WorldState;
  readonly events: readonly TraceEvent[];
  readonly frame: Frame;
  readonly previous?: ViewModel;
}): ViewModel {
  const agents = follow(input.previous?.agents ?? [], input.events);
  const acting = new Set(agents.map(({ id }) => id));
  const place = fit(input.frame);
  const shapes = input.world.entities.map((entity): Shape => {
    const { x, y, scale } = place(entity.position.x, entity.position.y);
    return {
      id: entity.id,
      shape: acting.has(entity.id) ? "circle" : "box",
      x,
      y,
      width: (amount(entity, "width") || DEFAULT_SIZE) * scale,
      height: (amount(entity, "depth") || DEFAULT_SIZE) * scale,
      level: entity.level,
      label: String(entity.props.kind ?? entity.id),
    };
  });
  return { shapes, agents };
}
