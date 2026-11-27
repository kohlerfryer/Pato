/** The only source of time in the simulation: a count of fixed ticks. */

export const TICKS_PER_SECOND = 30;

export interface Clock {
  /** Ticks since the run began. */
  readonly t: number;
  /** Advances one tick and returns the new count. */
  tick(): number;
}

export function createClock(): Clock {
  let t = 0;
  return {
    get t() {
      return t;
    },
    tick: () => ++t,
  };
}
