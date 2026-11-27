/** Writes what an eval measured, so a run can be compared with the one before it. */

import { mkdirSync, writeFileSync } from "node:fs";

const FOLDER = ".quality/evals";

interface Result {
  readonly pass: boolean;
  /** Every value the scenario measured, by name. */
  readonly values: Readonly<Record<string, number | boolean>>;
}

/** Writes one scenario's result as JSON, replacing the last. Returns the file's path. */
export function writeReport(scenario: string, result: Result): string {
  const path = `${FOLDER}/${scenario}.json`;
  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(path, `${JSON.stringify({ scenario, ...result }, null, 2)}\n`);
  return path;
}
