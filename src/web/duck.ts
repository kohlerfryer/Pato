/**
 * The duck as a character: a round white duck facing the viewer, with a curl on its head, an
 * orange beak and pink cheeks. Drawn in a 300 by 300 box whose feet meet the ground at (150, 270),
 * then placed and scaled onto its shape. It reads the view model and nothing else.
 */

import type { Shape } from "../view/model.ts";

const OUTLINE = "#3b2b20";
const WHITE = "#fbfaf6";
const WING = "#eceef2";
const ORANGE = "#f5a524";
const BEAK_LINE = "#c97c10";
const BLUSH = "rgba(246, 169, 163, 0.85)";
/** Where the feet meet the ground, in the drawing's own box. */
const FEET = { x: 150, y: 270 };
/** How many of the drawing's units span its shape's width. The duck stands well wider than its spot. */
const WIDTH_IN_BOX = 60;
/** How far a walking duck rocks from side to side, in radians. */
const ROCK = 0.05;
const STEP = 10;

const LEFT_FOOT = new Path2D("M118,258 q-16,10 -6,16 q12,4 24,0 q8,-6 -2,-16 Z");
const RIGHT_FOOT = new Path2D("M170,258 q-12,10 -2,16 q12,4 24,0 q8,-6 -4,-16 Z");
const CURL = new Path2D("M150,52 C140,30 166,22 170,36 C172,45 160,46 160,39");
const WING_PATH = new Path2D("M98,198 Q104,240 150,236 Q136,222 138,200 Q120,186 98,198 Z");
const BEAK = new Path2D("M136,128 Q156,116 176,128 Q172,148 156,148 Q140,148 136,128 Z");
const MOUTH = new Path2D("M144,134 Q156,139 168,134");
const CLOSED_EYES = new Path2D("M118,112 q10,8 20,0 M174,112 q10,8 20,0");

/** The body's outline, as one shape: tail, body and head. */
function silhouette(): Path2D {
  const shape = new Path2D("M84,196 Q48,186 56,158 Q74,172 98,176 Z");
  shape.ellipse(150, 206, 76, 58, 0, 0, Math.PI * 2);
  shape.moveTo(218, 112);
  shape.arc(156, 112, 62, 0, Math.PI * 2);
  return shape;
}
const BODY = silhouette();

function outlined(context: CanvasRenderingContext2D, path: Path2D, fill: string): void {
  context.fillStyle = fill;
  context.fill(path);
  context.stroke(path);
}

function feet(context: CanvasRenderingContext2D, lifted: boolean): void {
  context.save();
  if (lifted) context.translate(0, -STEP);
  outlined(context, LEFT_FOOT, ORANGE);
  context.restore();
  outlined(context, RIGHT_FOOT, ORANGE);
}

function body(context: CanvasRenderingContext2D): void {
  context.lineWidth = 6;
  context.stroke(CURL);
  context.lineWidth = 14;
  context.stroke(BODY);
  context.fillStyle = WHITE;
  context.fill(BODY);
  context.fillStyle = WING;
  context.beginPath();
  context.ellipse(170, 230, 44, 18, 0, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 5;
  outlined(context, WING_PATH, WING);
}

function face(context: CanvasRenderingContext2D, eyesShut: boolean): void {
  if (eyesShut) context.stroke(CLOSED_EYES);
  for (const x of eyesShut ? [] : [128, 184]) {
    context.fillStyle = OUTLINE;
    context.beginPath();
    context.arc(x, 110, 9.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = WHITE;
    context.beginPath();
    context.arc(x + 3, 106, 3.2, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = BLUSH;
  for (const x of [112, 200]) {
    context.beginPath();
    context.ellipse(x, 132, 12, 7, 0, 0, Math.PI * 2);
    context.fill();
  }
  outlined(context, BEAK, ORANGE);
  context.strokeStyle = BEAK_LINE;
  context.lineWidth = 3;
  context.stroke(MOUTH);
}

/** Draws the duck standing on its shape. `beat` alternates 0 and 1 to make a walk step. */
export function drawDuck(context: CanvasRenderingContext2D, shape: Shape, beat: number): void {
  const walking = shape.pose === "walking";
  context.save();
  context.translate(shape.x, shape.y);
  context.scale(shape.width / WIDTH_IN_BOX, shape.width / WIDTH_IN_BOX);
  if (walking) context.rotate(beat === 0 ? -ROCK : ROCK);
  context.translate(-FEET.x, -FEET.y);
  context.strokeStyle = OUTLINE;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = 5;
  feet(context, walking && beat === 0);
  body(context);
  face(context, shape.pose === "busy");
  context.restore();
}
