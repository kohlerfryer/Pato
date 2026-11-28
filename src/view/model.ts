/**
 * What to draw, as plain data: the world seen at an angle from above. Farther away is higher up
 * the screen and squashed, and each level lifts a thing straight up. The page turns this into
 * pixels and nothing else, so everything worth testing about the picture is decided here.
 */

import type { TraceEvent } from "../kernel/trace.ts";
import { type AgentView, follow } from "./agents.ts";
import { type Entity, type WorldState, amount } from "../world/state.ts";

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
  /** Whatever acts is a circle. Everything else is a block. */
  readonly shape: "circle" | "block";
  /** The centre of the patch of ground it covers, in screen pixels. */
  readonly x: number;
  readonly y: number;
  /** The size of that patch as it appears: full width, squashed depth. */
  readonly width: number;
  readonly height: number;
  /** How far it stands up from that patch, in pixels. */
  readonly tall: number;
  readonly level: number;
  readonly label: string;
  /** Whether some agent believes something about it right now. */
  readonly known: boolean;
}

/** How far an agent can see, as the patch of ground around it. */
interface Sight {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewModel {
  readonly shapes: readonly Shape[];
  readonly sights: readonly Sight[];
  readonly agents: readonly AgentView[];
}

/** How wide and deep to draw something that has no footprint of its own, in world units. */
const DEFAULT_SIZE = 1;
/** How tall to draw something that is flat on the ground, in world units, so it can be seen. */
const FLAT = 0.5;
/** How much a step away from the viewer moves a thing up the screen, against a step sideways. */
const SQUASH = 0.5;
/** How far up the screen one level lifts a thing, in world units. */
const LIFT = 1;

/** How tall to draw a thing: its height in levels, or a little when it is flat. */
const tallOf = (entity: Entity): number => amount(entity, "height") * LIFT || FLAT;

/** Where an entity's centre appears before scaling: across, and up the screen. */
const seenAt = (entity: Entity): { across: number; up: number } => ({
  across: entity.position.x,
  up: entity.position.y * SQUASH + entity.level * LIFT,
});

/** The box around everything as it appears at an angle, with `margin` of room on each side. */
export function boundsOf(world: WorldState, margin: number): Bounds {
  const seen = world.entities.map(seenAt);
  const xs = seen.map(({ across }) => across);
  const ys = seen.map(({ up }) => up);
  return {
    minX: Math.min(0, ...xs) - margin,
    minY: Math.min(0, ...ys) - margin,
    maxX: Math.max(0, ...xs) + margin,
    maxY:
      Math.max(0, ...world.entities.map((entity) => seenAt(entity).up + tallOf(entity))) + margin,
  };
}

/**
 * Places a point as it appears (across, up) on the screen: the whole frame fits, centred, at one scale for both axes,
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

/** The ids of everything some agent believes something about, not counting itself. */
function believedAbout(agents: readonly AgentView[]): Set<string | undefined> {
  return new Set(
    agents.flatMap(({ id, beliefs }) =>
      beliefs.flatMap(({ subject, object }) => [subject, object]).filter((named) => named !== id),
    ),
  );
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
  const known = believedAbout(agents);
  const place = fit(input.frame);
  const farFirst = [...input.world.entities].sort((a, b) => b.position.y - a.position.y);
  const shapes = farFirst.map((entity): Shape => {
    const { across, up } = seenAt(entity);
    const { x, y, scale } = place(across, up);
    return {
      id: entity.id,
      shape: acting.has(entity.id) ? "circle" : "block",
      x,
      y,
      width: (amount(entity, "width") || DEFAULT_SIZE) * scale,
      height: (amount(entity, "depth") || DEFAULT_SIZE) * SQUASH * scale,
      tall: tallOf(entity) * scale,
      level: entity.level,
      label: String(entity.props.kind ?? entity.id),
      known: known.has(entity.id),
    };
  });
  const sights = farFirst
    .filter((entity) => acting.has(entity.id) && amount(entity, "sight") > 0)
    .map((entity): Sight => {
      const { across, up } = seenAt(entity);
      const { x, y, scale } = place(across, up);
      const reach = amount(entity, "sight") * scale;
      return { id: entity.id, x, y, width: reach * 2, height: reach * 2 * SQUASH };
    });
  return { shapes, sights, agents };
}
