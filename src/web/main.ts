/**
 * The page: runs a scenario in the browser and draws it. It holds no logic of its own. What to
 * run comes from the address, and what to draw comes from the view model.
 */

import { loadContent } from "../content/content.ts";
import { loadScenarios } from "../content/scenarios.ts";
import { createRun } from "../evals/run.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { fromAddress } from "../view/address.ts";
import { type ViewModel, boundsOf, viewModel } from "../view/model.ts";

/** Room to leave around the scene, in world units. */
const MARGIN = 2;
/** The most ticks to run in one frame, so a page left in the background doesn't race to catch up. */
const MAX_CATCH_UP = 5;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
const LABEL_PX = 12;
const INK = "#5b3d1f";
const BOX = "#c9a66b";
const CIRCLE = "#f2c14e";

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

function draw(context: CanvasRenderingContext2D, view: ViewModel, ratio: number): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.font = `${String(LABEL_PX * ratio)}px system-ui, sans-serif`;
  context.textAlign = "center";
  for (const { shape, x, y, width, height, level, label } of view.shapes) {
    context.fillStyle = shape === "circle" ? CIRCLE : BOX;
    context.beginPath();
    if (shape === "circle") context.arc(x, y, width / 2, 0, Math.PI * 2);
    else context.rect(x - width / 2, y - height / 2, width, height);
    context.fill();
    context.fillStyle = INK;
    const text = level > 0 ? `${label} (up ${String(level)})` : label;
    context.fillText(text, x, y + height / 2 + LABEL_PX * ratio * 1.2);
  }
}

const describe = (view: ViewModel): string =>
  view.agents
    .map(
      ({ id, goal, thought }) =>
        `${id} wants ${goal ?? "nothing"}${thought === null ? "" : ` · ${thought}`}`,
    )
    .join("\n");

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
    draw(context, view, ratio);
    status.textContent = describe(view);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const canvas = document.querySelector("canvas");
const status = document.getElementById("status");
if (canvas && status) start(canvas, status);
