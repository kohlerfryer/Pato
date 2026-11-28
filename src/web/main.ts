/**
 * The page: runs a scenario in the browser and draws it. It holds no logic of its own. What to
 * run comes from the address, and what to draw comes from the view model.
 */

import { loadContent } from "../content/content.ts";
import { loadScenarios } from "../content/scenarios.ts";
import { createRun } from "../evals/run.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { fromAddress } from "../view/address.ts";
import { drawDuck } from "./duck.ts";
import { lines } from "../view/agents.ts";
import { type Shape, type ViewModel, boundsOf, viewModel } from "../view/model.ts";

/** Room to leave around the scene, in world units. */
const MARGIN = 2;
/** The most ticks to run in one frame, so a page left in the background doesn't race to catch up. */
const MAX_CATCH_UP = 5;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
const LABEL_PX = 12;
const INK = "#5b3d1f";
const BOX = "#d9b97f";
const FRONT = "#b08a4f";
const FIELD = "#dcebb5";
const SHADE = "rgba(60, 40, 10, 0.18)";
/** How many frames each step of a walk lasts. */
const FRAMES_PER_STEP = 8;

/** Makes the canvas as sharp as the screen allows. Returns how many canvas pixels make one screen pixel. */
function sharpen(canvas: HTMLCanvasElement): number {
  const ratio = window.devicePixelRatio;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return ratio;
}

function draw(
  context: CanvasRenderingContext2D,
  view: ViewModel,
  ratio: number,
  beat: number,
): void {
  context.fillStyle = FIELD;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.font = `${String(LABEL_PX * ratio)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.strokeStyle = INK;
  context.lineWidth = ratio;
  context.setLineDash([4 * ratio, 6 * ratio]);
  for (const { x, y, width, height } of view.sights) {
    context.beginPath();
    context.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.setLineDash([]);
  for (const shape of view.shapes) {
    if (shape.shape === "circle") drawAgent(context, shape, beat);
    else drawThing(context, shape, ratio);
  }
}

/** An agent: the duck, on a soft shadow as wide as it stands. */
function drawAgent(context: CanvasRenderingContext2D, shape: Shape, beat: number): void {
  context.fillStyle = SHADE;
  context.beginPath();
  context.ellipse(shape.x, shape.y, shape.width, shape.height, 0, 0, Math.PI * 2);
  context.fill();
  drawDuck(context, shape, beat);
}

/** Anything else: a box with a top and a front, outlined when believed in, and labelled. */
function drawThing(context: CanvasRenderingContext2D, shape: Shape, ratio: number): void {
  const { x, y, width, height, tall, level, label, known } = shape;
  const near = y + height / 2;
  context.fillStyle = FRONT;
  context.fillRect(x - width / 2, near - tall, width, tall);
  context.fillStyle = BOX;
  context.beginPath();
  context.rect(x - width / 2, y - height / 2 - tall, width, height);
  context.fill();
  if (known) context.stroke();
  context.fillStyle = INK;
  const text = level > 0 ? `${label} (up ${String(level)})` : label;
  context.fillText(text, x, near + LABEL_PX * ratio * 1.2);
}

function start(canvas: HTMLCanvasElement, status: HTMLElement): void {
  const context = canvas.getContext("2d");
  const scenarios = loadScenarios();
  const { scenario: id, seed } = fromAddress(
    location.search,
    scenarios.map((each) => each.id),
  );
  const scenario = scenarios.find((each) => each.id === id);
  if (!context || !scenario) {
    status.textContent = "There is nothing to run.";
    return;
  }
  const { kernel } = createRun(scenario, loadContent(), seed);
  const bounds = boundsOf(kernel.world, MARGIN);
  let view: ViewModel | undefined;
  let seen = 0;
  let frames = 0;
  let last: number | undefined;
  let owed = MS_PER_TICK;

  const frame = (now: number): void => {
    owed = Math.min(owed + (last === undefined ? 0 : now - last), MAX_CATCH_UP * MS_PER_TICK);
    last = now;
    for (; owed >= MS_PER_TICK; owed -= MS_PER_TICK) kernel.tick();
    const ratio = sharpen(canvas);
    const events = kernel.trace.events.slice(seen);
    seen = kernel.trace.events.length;
    const viewport = { width: canvas.width, height: canvas.height };
    view = viewModel({
      world: kernel.world,
      events,
      frame: { bounds, viewport },
      ...(view ? { previous: view } : {}),
    });
    frames += 1;
    draw(context, view, ratio, Math.floor(frames / FRAMES_PER_STEP) % 2);
    status.textContent = view.agents.flatMap(lines).join("\n");
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const canvas = document.querySelector("canvas");
const status = document.getElementById("status");
if (canvas && status) start(canvas, status);
