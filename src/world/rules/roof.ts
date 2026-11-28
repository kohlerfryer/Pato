/** Roof: being inside it, or holding it, keeps the rain off. */

import type { PropertyRule } from "../property.ts";

const rule: PropertyRule = {
  keepsRainOff: (strength) => strength === true,
};

export default rule;
