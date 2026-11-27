/** Which scenario and seed the page should run, read from its address: `?scenario=01-alone&seed=3`. */

const FIRST_SEED = 1;

export function fromAddress(
  search: string,
  scenarios: readonly string[],
): { readonly scenario: string | null; readonly seed: number } {
  const params = new URLSearchParams(search);
  const asked = params.get("scenario");
  const seed = Number(params.get("seed"));
  return {
    scenario: asked !== null && scenarios.includes(asked) ? asked : (scenarios[0] ?? null),
    seed: Number.isInteger(seed) && seed >= FIRST_SEED ? seed : FIRST_SEED,
  };
}
