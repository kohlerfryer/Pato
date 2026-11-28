import { describe, expect, it } from "vitest";

import { loadContent } from "../content/content.ts";
import { loadScenarios } from "../content/scenarios.ts";
import { TICKS_PER_SECOND } from "../kernel/clock.ts";
import { createRun } from "./run.ts";

const content = loadContent();
const [scenario] = loadScenarios();
/** New names that sort the same way among each other and the creatures, so no tie breaks differently. */
const renames = new Map(content.objects.map(({ id }) => [id, `${id}x`]));
const renamed = (id: string): string => renames.get(id) ?? id;

function trace(
  objects = content.objects,
  setup = scenario?.setup,
  triggers = scenario?.triggers,
): string {
  if (!scenario || !setup || !triggers) throw new Error("there is no scenario to run");
  const { kernel } = createRun({ ...scenario, setup, triggers }, { ...content, objects }, 1);
  for (let i = 0; i < 120 * TICKS_PER_SECOND; i++) kernel.tick();
  return kernel.trace.text();
}

describe("names", () => {
  it("[S-VOCAB-3] renaming every object id in a scenario changes the trace only in those ids", () => {
    if (!scenario) throw new Error("there is no scenario to run");
    const objects = content.objects.map((object) => ({ ...object, id: renamed(object.id) }));
    const setup = {
      ...scenario.setup,
      objects: scenario.setup.objects.map((placed) => ({ ...placed, kind: renamed(placed.kind) })),
    };
    const triggers = scenario.triggers.map((trigger) =>
      "spawn" in trigger
        ? { ...trigger, spawn: { ...trigger.spawn, kind: renamed(trigger.spawn.kind) } }
        : trigger,
    );
    const original = trace();
    let back = trace(objects, setup, triggers);
    for (const [id, name] of renames) back = back.replaceAll(`"${name}-`, `"${id}-`);
    expect(back).toBe(original);
    expect(original.length).toBeGreaterThan(1000);
  });
});
