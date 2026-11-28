/** Grabbable: it can be picked up and carried. */

import type { PropertyRule } from "../property.ts";

const rule: PropertyRule = {
  canGrab: (strength) => strength === true,
};

export default rule;
