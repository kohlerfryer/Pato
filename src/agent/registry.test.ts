import { describe, expect, it } from "vitest";

import { createBelief } from "./belief.ts";
import type { Fact } from "./fact.ts";
import { createRegistry } from "./registry.ts";
import { type Skill, matches } from "./skill.ts";

const eat: Skill = {
  id: "eat",
  params: { food: { has: ["edible"] } },
  pre: [{ subject: "$self", predicate: "near", object: "$food", op: "is", value: true }],
  effects: [{ subject: "$self", predicate: "hunger", op: "below", value: 0.2 }],
  body: [
    { kind: "move_to", target: "$food" },
    { kind: "use", target: "$food" },
  ],
  origin: "instinct",
};

const has = (subject: string, predicate: string, value = true): Fact => ({
  subject,
  predicate,
  value,
  confidence: 1,
  tEvent: 0,
  ttl: 100,
  source: "sight",
});

describe("registry", () => {
  it("[S-REG-1] keeps a skill with its id, parameters, preconditions, effects, body and origin", () => {
    const registry = createRegistry();
    expect(registry.register(eat)).toBeNull();
    expect(registry.get("eat")).toEqual(eat);
    expect(Object.keys(registry.get("eat") ?? {}).sort()).toEqual(
      ["body", "effects", "id", "origin", "params", "pre"].sort(),
    );
  });

  it("[S-REG-1] lists skills in the order they were registered", () => {
    const registry = createRegistry();
    registry.register({ ...eat, id: "second" });
    registry.register({ ...eat, id: "first" });
    expect(registry.list().map((skill) => skill.id)).toEqual(["second", "first"]);
  });

  it("[S-REG-1] knows nothing of a skill that was never registered", () => {
    expect(createRegistry().get("eat")).toBeUndefined();
  });
});

describe("matches", () => {
  const belief = createBelief();
  for (const fact of [
    has("x", "edible"),
    has("y", "edible"),
    has("y", "soft"),
    has("z", "soft"),
    has("edible", "soft"),
    has("w", "edible", false),
  ])
    belief.add(fact);

  it("[S-REG-1] matches a parameter by property, whatever the entity is called", () => {
    const edible = ["x", "y", "z", "edible", "w"].filter((id) =>
      matches(belief, id, { has: ["edible"] }),
    );
    expect(edible).toEqual(["x", "y"]);
  });

  it("[S-REG-1] needs every property the parameter asks for", () => {
    expect(matches(belief, "y", { has: ["edible", "soft"] })).toBe(true);
    expect(matches(belief, "x", { has: ["edible", "soft"] })).toBe(false);
  });

  it("[S-REG-1] matches only entities it believes in", () => {
    expect(matches(belief, "z", { has: [] })).toBe(true);
    expect(matches(belief, "nobody", { has: [] })).toBe(false);
  });
});

describe("registry rejects", () => {
  const withBody = (body: unknown): Skill => ({ ...eat, body: body as Skill["body"] });

  it("[S-REG-2] turns away a body step that isn't one of the five actions", () => {
    const registry = createRegistry();
    expect(registry.register(withBody([{ kind: "fly", target: "$food" }]))).toContain("fly");
    expect(registry.get("eat")).toBeUndefined();
  });

  it("[S-REG-2] turns away a target that names an entity instead of a parameter", () => {
    expect(createRegistry().register(withBody([{ kind: "grab", target: "obj-3" }]))).toContain(
      "obj-3",
    );
  });

  it("[S-REG-2] turns away a target that names a parameter the skill doesn't have", () => {
    expect(createRegistry().register(withBody([{ kind: "use", target: "$other" }]))).toContain(
      "$other",
    );
  });

  it("[S-REG-2] turns away a target that is a fixed spot", () => {
    expect(
      createRegistry().register(withBody([{ kind: "move_to", target: { x: 1 } }])),
    ).not.toBeNull();
  });

  it("[S-REG-2] takes actions that need no target", () => {
    const body = [{ kind: "jump" }, { kind: "drop" }, { kind: "use" }];
    expect(createRegistry().register(withBody(body))).toBeNull();
  });

  it("[S-REG-2] names the skill it turned away", () => {
    expect(createRegistry().register(withBody([{ kind: "fly" }]))).toContain("eat");
  });
});
