/** Has opening: it can be walked into, and whoever is within it is inside it. */

import type { PropertyRule } from "../property.ts";

const rule: PropertyRule = {
  canEnter: (strength) => strength === true,
};

export default rule;
