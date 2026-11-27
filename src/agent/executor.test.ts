import { describe, expect, it } from "vitest";

import type { Action, Outcome } from "./action.ts";
import { type Emit, createExecutor } from "./executor.ts";
import type { Skill } from "./skill.ts";

const fetch: Skill = {
  id: "fetch",
  params: { thing: { has: ["grabbable"] } },
  pre: [],
  effects: [],
  body: [
    { kind: "move_to", target: "$thing" },
    { kind: "grab", target: "$thing" },
    { kind: "jump" },
  ],
  origin: "learned",
};
const args = { thing: "t-1" };
const done: Outcome = { status: "done" };
const met = (): undefined => undefined;

type Logged = [string, Record<string, unknown>];

function logging(): { emit: Emit; log: Logged[] } {
  const log: Logged[] = [];
  return { emit: (type, data) => log.push([type, data]), log };
}

const withBody = (body: unknown): Skill => ({ ...fetch, body: body as Skill["body"] });

describe("executor", () => {
  it("[S-EXEC-1] does nothing while it has no skill", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    expect(executor.tick(undefined, emit, met)).toBeNull();
    expect(executor.busy).toBe(false);
    expect(log).toEqual([]);
  });

  it("[S-EXEC-1] runs one skill at a time", () => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    expect(executor.busy).toBe(true);
    expect(() => {
      executor.start(fetch, args, emit);
    }).toThrow("busy");
  });

  it("[S-EXEC-1] advances at most one action step per tick, aiming each at the skill's arguments", () => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    const asked: (Action | null)[] = [
      executor.tick(undefined, emit, met),
      executor.tick(undefined, emit, met),
      executor.tick(done, emit, met),
      executor.tick(done, emit, met),
      executor.tick(done, emit, met),
    ];
    expect(asked).toEqual([
      { kind: "move_to", target: "t-1" },
      { kind: "move_to", target: "t-1" },
      { kind: "grab", target: "t-1" },
      { kind: "jump" },
      null,
    ]);
    expect(executor.busy).toBe(false);
  });

  it("[S-ACT-2] logs the start and the end of every action, and of the skill", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind: "jump" }]), args, emit);
    executor.tick(undefined, emit, met);
    executor.tick(undefined, emit, met);
    executor.tick(done, emit, met);
    expect(log).toEqual([
      ["skill", { phase: "start", skill: "fetch", args }],
      ["action", { phase: "start", action: { kind: "jump" } }],
      ["action", { phase: "end", action: { kind: "jump" }, status: "done" }],
      ["skill", { phase: "done", skill: "fetch" }],
    ]);
  });

  it("[S-ACT-2] logs why an action failed, and fails its skill without running the rest", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    executor.tick(undefined, emit, met);
    expect(executor.tick({ status: "failed", reason: "unreachable" }, emit, met)).toBeNull();
    expect(log.slice(2)).toEqual([
      [
        "action",
        {
          phase: "end",
          action: { kind: "move_to", target: "t-1" },
          status: "failed",
          reason: "unreachable",
        },
      ],
      ["skill", { phase: "failed", skill: "fetch", reason: "unreachable" }],
    ]);
    expect(executor.busy).toBe(false);
  });

  it("[S-ACT-2] ends an action that was interrupted the same way, with its reason", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    executor.tick(undefined, emit, met);
    executor.tick({ status: "interrupted", reason: "new_goal" }, emit, met);
    expect(log.at(-2)?.[1]).toMatchObject({ status: "interrupted", reason: "new_goal" });
  });

  it.each(["move_to", "jump", "grab", "drop", "use"])("[S-ACT-1] starts a %s action", (kind) => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind }]), args, emit);
    expect(executor.tick(undefined, emit, met)).toEqual({ kind });
  });

  it("[S-ACT-1] rejects any other action without asking the world for it", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind: "fly" }, { kind: "jump" }]), args, emit);
    expect(executor.tick(undefined, emit, met)).toBeNull();
    expect(log.slice(1)).toEqual([
      [
        "action",
        { phase: "end", action: { kind: "fly" }, status: "failed", reason: "unknown_action" },
      ],
      ["skill", { phase: "failed", skill: "fetch", reason: "unknown_action" }],
    ]);
    expect(executor.busy).toBe(false);
  });

  it("[S-ACT-2] fails an action whose target names nothing it was given", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(fetch, {}, emit);
    expect(executor.tick(undefined, emit, met)).toBeNull();
    expect(log.at(-1)).toEqual([
      "skill",
      { phase: "failed", skill: "fetch", reason: "unbound_target" },
    ]);
  });

  it("[S-EXEC-1] can take a new skill once the last one has ended", () => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(withBody([]), args, emit);
    expect(executor.tick(undefined, emit, met)).toBeNull();
    executor.start(fetch, args, emit);
    expect(executor.busy).toBe(true);
  });
});

describe("interrupting", () => {
  it("[S-EXEC-2] stops the running skill at its next action boundary, and logs it", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    executor.tick(undefined, emit, met);
    executor.interrupt("new_goal");
    expect(executor.tick(undefined, emit, met)).toEqual({ kind: "move_to", target: "t-1" });
    expect(executor.busy).toBe(true);
    expect(executor.tick(done, emit, met)).toBeNull();
    expect(log.slice(2)).toEqual([
      ["action", { phase: "end", action: { kind: "move_to", target: "t-1" }, status: "done" }],
      ["skill", { phase: "interrupted", skill: "fetch", reason: "new_goal" }],
    ]);
    expect(executor.busy).toBe(false);
  });

  it("[S-EXEC-2] lets a skill finish when the interruption comes during its last action", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind: "jump" }]), args, emit);
    executor.tick(undefined, emit, met);
    executor.interrupt("new_goal");
    executor.tick(done, emit, met);
    expect(log.at(-1)).toEqual(["skill", { phase: "done", skill: "fetch" }]);
  });

  it("[S-EXEC-2] stops a skill that has not started its first action yet", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(fetch, args, emit);
    executor.interrupt("new_goal");
    expect(executor.tick(undefined, emit, met)).toBeNull();
    expect(log).toHaveLength(2);
  });

  it("[S-EXEC-2] does nothing when no skill is running, and doesn't carry over to the next", () => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.interrupt("new_goal");
    executor.start(fetch, args, emit);
    expect(executor.tick(undefined, emit, met)).toEqual({ kind: "move_to", target: "t-1" });
  });
});

describe("effects", () => {
  const effect = {
    subject: "$self",
    predicate: "holding",
    object: "$thing",
    op: "is",
    value: true,
  } as const;
  const grabbing: Skill = {
    ...fetch,
    effects: [effect],
    body: [{ kind: "grab", target: "$thing" }],
  };

  it("[S-EXEC-3] ends a skill done only if its declared effects hold after its last action", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    const asked: unknown[] = [];
    executor.start(grabbing, args, emit);
    executor.tick(undefined, emit, met);
    executor.tick(done, emit, (skill, given) => {
      asked.push([skill.id, given]);
      return undefined;
    });
    expect(log.at(-1)).toEqual(["skill", { phase: "done", skill: "fetch" }]);
    expect(asked).toEqual([["fetch", args]]);
  });

  it("[S-EXEC-3] otherwise ends it failed, naming the unmet effect", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(grabbing, args, emit);
    executor.tick(undefined, emit, met);
    executor.tick(done, emit, () => effect);
    expect(log.at(-1)).toEqual([
      "skill",
      { phase: "failed", skill: "fetch", reason: "effect_unmet", effect },
    ]);
    expect(executor.busy).toBe(false);
  });

  it("[S-EXEC-3] doesn't check effects before the last action has ended", () => {
    const { emit } = logging();
    const executor = createExecutor();
    let checks = 0;
    const counting = (): undefined => {
      checks += 1;
      return undefined;
    };
    executor.start(fetch, args, emit);
    executor.tick(undefined, emit, counting);
    executor.tick(done, emit, counting);
    executor.tick(done, emit, counting);
    expect(checks).toBe(0);
    executor.tick(done, emit, counting);
    expect(checks).toBe(1);
  });

  it("[S-EXEC-3] doesn't check the effects of a skill whose action failed", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(grabbing, args, emit);
    executor.tick(undefined, emit, met);
    executor.tick({ status: "failed", reason: "too_far" }, emit, () => effect);
    expect(log.at(-1)).toEqual(["skill", { phase: "failed", skill: "fetch", reason: "too_far" }]);
  });
});
