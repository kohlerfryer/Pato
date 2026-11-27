/** What a planner hands back. The kernel checks it before anything runs. */

import type { EntityId } from "../agent/fact.ts";

export interface PlanOutput {
  /** The id of a registered skill. */
  readonly skill: string;
  /** Which entity fills each of the skill's parameters. */
  readonly args: Readonly<Record<string, EntityId>>;
  /** What it expects to happen, shown as a thought bubble. */
  readonly guess?: string;
  /** What it tells a kid, also shown as a thought bubble. */
  readonly say?: string;
}
