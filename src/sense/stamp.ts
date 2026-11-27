/** Turns what a sensor noticed into a fact: sure of itself, dated now, believed for a while. */

import type { Fact } from "../agent/fact.ts";

type Noticed = Pick<Fact, "subject" | "predicate" | "value"> & { readonly object?: string };

export function stamper(source: string, t: number, ttl: number): (noticed: Noticed) => Fact {
  return (noticed) => ({ ...noticed, confidence: 1, tEvent: t, ttl, source });
}
