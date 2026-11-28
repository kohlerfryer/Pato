/** Flat top: its top can be stood on, and jumped onto from one level below. */

import type { PropertyRule } from "../property.ts";

const rule: PropertyRule = {
  canStandOn: (strength) => strength === true,
};

export default rule;
