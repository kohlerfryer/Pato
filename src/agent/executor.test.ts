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
    expect(executor.tick(undefined, emit)).toBeNull();
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
      executor.tick(undefined, emit),
      executor.tick(undefined, emit),
      executor.tick(done, emit),
      executor.tick(done, emit),
      executor.tick(done, emit),
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
    executor.tick(undefined, emit);
    executor.tick(undefined, emit);
    executor.tick(done, emit);
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
    executor.tick(undefined, emit);
    expect(executor.tick({ status: "failed", reason: "unreachable" }, emit)).toBeNull();
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
    executor.tick(undefined, emit);
    executor.tick({ status: "interrupted", reason: "new_goal" }, emit);
    expect(log.at(-2)?.[1]).toMatchObject({ status: "interrupted", reason: "new_goal" });
  });

  it.each(["move_to", "jump", "grab", "drop", "use"])("[S-ACT-1] starts a %s action", (kind) => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind }]), args, emit);
    expect(executor.tick(undefined, emit)).toEqual({ kind });
  });

  it("[S-ACT-1] rejects any other action without asking the world for it", () => {
    const { emit, log } = logging();
    const executor = createExecutor();
    executor.start(withBody([{ kind: "fly" }, { kind: "jump" }]), args, emit);
    expect(executor.tick(undefined, emit)).toBeNull();
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
    expect(executor.tick(undefined, emit)).toBeNull();
    expect(log.at(-1)).toEqual([
      "skill",
      { phase: "failed", skill: "fetch", reason: "unbound_target" },
    ]);
  });

  it("[S-EXEC-1] can take a new skill once the last one has ended", () => {
    const { emit } = logging();
    const executor = createExecutor();
    executor.start(withBody([]), args, emit);
    expect(executor.tick(undefined, emit)).toBeNull();
    executor.start(fetch, args, emit);
    expect(executor.busy).toBe(true);
  });
});
