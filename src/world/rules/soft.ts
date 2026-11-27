/** Soft: using it is resting on it. Sleepiness falls by its amount each second until none is left. */

import { TICKS_PER_SECOND } from "../../kernel/clock.ts";
import type { PropertyRule } from "../property.ts";
import { amount, withEntity } from "../state.ts";

/** Less sleepiness than this counts as none, so rounding never costs a tick. */
const NONE_LEFT = 1e-9;

const rule: PropertyRule = {
  use(state, actor, _object, strength) {
    const eased = (typeof strength === "number" ? strength : 0) / TICKS_PER_SECOND;
    const left = amount(actor, "sleepiness") - eased;
    const sleepiness = left > NONE_LEFT ? left : 0;
    const next = withEntity(state, { ...actor, props: { ...actor.props, sleepiness } });
    return sleepiness > 0 ? { state: next } : { state: next, outcome: { status: "done" } };
  },
};

export default rule;
