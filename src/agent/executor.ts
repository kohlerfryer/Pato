/**
 * Runs one skill at a time for one agent: starts each action of its body in turn, waits for the
 * world to say how it ended, and logs every start and end.
 */

import { type Action, type Outcome, isActionKind } from "./action.ts";
import { nameIn } from "./condition.ts";
import type { EntityId } from "./fact.ts";
import type { Skill } from "./skill.ts";

/** Writes one trace event about this agent. */
export type Emit = (type: "skill" | "action", data: Record<string, unknown>) => void;

type Args = Readonly<Record<string, EntityId>>;

export interface Executor {
  /** Whether a skill is under way. */
  readonly busy: boolean;
  /** Takes on `skill`. Throws if one is already under way. */
  start(skill: Skill, args: Args, emit: Emit): void;
  /**
   * Moves on by at most one action step. `ended` is how the action in flight ended, if it has.
   * Returns the action the world should carry on with, or null when there is none.
   */
  tick(ended: Outcome | undefined, emit: Emit): Action | null;
}

interface Running {
  readonly skill: Skill;
  readonly args: Args;
  /** The body step to start next. */
  next: number;
  /** The action in flight. */
  action: Action | null;
}

/** `step` aimed at what the skill was given, or the reason it can't be. */
function aimed(step: Action, args: Args): Action | string {
  if (!isActionKind((step as { kind: unknown }).kind)) return "unknown_action";
  if (!("target" in step) || typeof step.target !== "string") return step;
  const name = nameIn(step.target);
  if (name === null) return step;
  const entity = args[name];
  return entity === undefined ? "unbound_target" : { ...step, target: entity };
}

/** Starts the next step of the body. Returns the action started, or the reason the skill is over. */
function begin(running: Running, emit: Emit): Action | { readonly over: string | null } {
  const step = running.skill.body[running.next];
  if (!step) return { over: null };
  running.next += 1;
  const action = aimed(step, running.args);
  if (typeof action === "string") {
    emit("action", { phase: "end", action: step, status: "failed", reason: action });
    return { over: action };
  }
  emit("action", { phase: "start", action });
  running.action = action;
  return action;
}

/** Notes how the action in flight ended. Returns why the skill failed, if it did. */
function settle(running: Running, ended: Outcome, emit: Emit): string | null {
  emit("action", { phase: "end", action: running.action, ...ended });
  running.action = null;
  return ended.status === "done" ? null : ended.reason;
}

export function createExecutor(): Executor {
  let running: Running | null = null;
  const finish = ({ skill }: Running, reason: string | null, emit: Emit): null => {
    const id = skill.id;
    emit(
      "skill",
      reason === null ? { phase: "done", skill: id } : { phase: "failed", skill: id, reason },
    );
    running = null;
    return null;
  };
  return {
    get busy() {
      return running !== null;
    },
    start(skill, args, emit) {
      if (running) throw new Error(`the executor is busy with ${running.skill.id}`);
      running = { skill, args, next: 0, action: null };
      emit("skill", { phase: "start", skill: skill.id, args });
    },
    tick(ended, emit) {
      if (!running) return null;
      if (running.action) {
        if (!ended) return running.action;
        const failure = settle(running, ended, emit);
        if (failure !== null) return finish(running, failure, emit);
      }
      const begun = begin(running, emit);
      return "over" in begun ? finish(running, begun.over, emit) : begun;
    },
  };
}
