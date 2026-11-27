/**
 * Runs one skill at a time for one agent: starts each action of its body in turn, waits for the
 * world to say how it ended, and logs every start and end.
 */

import { type Action, type Outcome, isActionKind } from "./action.ts";
import { type Condition, nameIn } from "./condition.ts";
import type { EntityId } from "./fact.ts";
import type { Skill } from "./skill.ts";

/** Writes one trace event about this agent. */
export type Emit = (type: "skill" | "action", data: Record<string, unknown>) => void;

type Args = Readonly<Record<string, EntityId>>;

/** Says which of a skill's declared effects doesn't hold in belief, if any. */
type Unmet = (skill: Skill, args: Args) => Condition | undefined;

export interface Executor {
  /** Whether a skill is under way. */
  readonly busy: boolean;
  /** Takes on `skill`. Throws if one is already under way. */
  start(skill: Skill, args: Args, emit: Emit): void;
  /** Asks the running skill to stop at its next action boundary. Does nothing when idle. */
  interrupt(reason: string): void;
  /**
   * Moves on by at most one action step. `ended` is how the action in flight ended, if it has.
   * Returns the action the world should carry on with, or null when there is none.
   */
  tick(ended: Outcome | undefined, emit: Emit, unmet: Unmet): Action | null;
}

interface Running {
  readonly skill: Skill;
  readonly args: Args;
  /** The body step to start next. */
  next: number;
  /** The action in flight. */
  action: Action | null;
  /** Why it has been asked to stop, if it has. */
  interrupted: string | null;
}

/** How a skill ended, as it goes in the trace. */
type Ending =
  | { readonly phase: "done" }
  | {
      readonly phase: "failed" | "interrupted";
      readonly reason: string;
      readonly effect?: Condition;
    };

/** `step` aimed at what the skill was given, or the reason it can't be. */
function aimed(step: Action, args: Args): Action | string {
  if (!isActionKind((step as { kind: unknown }).kind)) return "unknown_action";
  if (!("target" in step) || typeof step.target !== "string") return step;
  const name = nameIn(step.target);
  if (name === null) return step;
  const entity = args[name];
  return entity === undefined ? "unbound_target" : { ...step, target: entity };
}

/** Starts a step of the body. Returns the action started, or why no action could start. */
function begin(running: Running, step: Action, emit: Emit): Action | string {
  running.next += 1;
  const action = aimed(step, running.args);
  if (typeof action === "string") {
    emit("action", { phase: "end", action: step, status: "failed", reason: action });
    return action;
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

/** Decides what follows an action boundary: the next step, or the end of the skill. */
function advance(running: Running, emit: Emit, unmet: Unmet): Action | Ending {
  const step = running.skill.body[running.next];
  if (!step) {
    const effect = unmet(running.skill, running.args);
    return effect ? { phase: "failed", reason: "effect_unmet", effect } : { phase: "done" };
  }
  if (running.interrupted !== null) return { phase: "interrupted", reason: running.interrupted };
  const begun = begin(running, step, emit);
  return typeof begun === "string" ? { phase: "failed", reason: begun } : begun;
}

export function createExecutor(): Executor {
  let running: Running | null = null;
  const finish = ({ skill }: Running, ending: Ending, emit: Emit): null => {
    emit("skill", { ...ending, skill: skill.id });
    running = null;
    return null;
  };
  return {
    get busy() {
      return running !== null;
    },
    start(skill, args, emit) {
      if (running) throw new Error(`the executor is busy with ${running.skill.id}`);
      running = { skill, args, next: 0, action: null, interrupted: null };
      emit("skill", { phase: "start", skill: skill.id, args });
    },
    interrupt(reason) {
      if (running) running.interrupted = reason;
    },
    tick(ended, emit, unmet) {
      if (!running) return null;
      if (running.action) {
        if (!ended) return running.action;
        const failure = settle(running, ended, emit);
        if (failure !== null) return finish(running, { phase: "failed", reason: failure }, emit);
      }
      const next = advance(running, emit, unmet);
      return "phase" in next ? finish(running, next, emit) : next;
    },
  };
}
