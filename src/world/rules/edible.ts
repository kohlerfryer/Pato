/** Edible: using it removes it and takes its amount off the user's hunger. It comes back after the world's delay. */

import type { PropertyRule } from "../property.ts";
import { amount } from "../state.ts";

const rule: PropertyRule = {
  use(state, actor, object, strength) {
    const eaten = typeof strength === "number" ? strength : 0;
    const hunger = Math.max(0, amount(actor, "hunger") - eaten);
    const fed = { ...actor, props: { ...actor.props, hunger } };
    const entities = state.entities
      .filter((each) => each.id !== object.id)
      .map((each) => (each.id === actor.id ? fed : each));
    const away =
      state.respawn > 0 ? [...state.away, { entity: object, ticks: state.respawn }] : state.away;
    return { state: { ...state, entities, away }, outcome: { status: "done" } };
  },
};

export default rule;
