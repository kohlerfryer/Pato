import { describe, expect, it } from "vitest";

import { fromAddress } from "./address.ts";

const scenarios = ["01-alone", "02-house"];

describe("fromAddress", () => {
  it("[S-DRAW-4] takes the scenario and seed from the page's address", () => {
    expect(fromAddress("?scenario=02-house&seed=7", scenarios)).toEqual({
      scenario: "02-house",
      seed: 7,
    });
  });

  it("[S-DRAW-4] runs the first scenario with seed 1 when the address gives none", () => {
    expect(fromAddress("", scenarios)).toEqual({ scenario: "01-alone", seed: 1 });
  });

  it("[S-DRAW-4] falls back to the first scenario when the one asked for doesn't exist", () => {
    expect(fromAddress("?scenario=99-nope&seed=4", scenarios)).toEqual({
      scenario: "01-alone",
      seed: 4,
    });
  });

  it.each(["abc", "1.5", "-2", ""])(
    "[S-DRAW-4] falls back to seed 1 when the seed is %j",
    (seed) => {
      expect(fromAddress(`?seed=${seed}`, scenarios).seed).toBe(1);
    },
  );

  it("[S-DRAW-4] has no scenario to run when there are none", () => {
    expect(fromAddress("?scenario=01-alone", [])).toEqual({ scenario: null, seed: 1 });
  });
});
