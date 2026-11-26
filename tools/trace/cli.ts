/** `pnpm trace` checks docs, tests and phase against each other; `pnpm next` also lists what to build. */

import { appendFileSync } from "node:fs";

import { runTrace } from "./run.ts";

const NEXT_COUNT = 5;

const { lines, ok } = runTrace(process.cwd(), process.argv.includes("--next") ? NEXT_COUNT : 0);
console.log(lines.join("\n"));
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) appendFileSync(summaryFile, ["### Trace", "```", ...lines, "```", ""].join("\n"));
process.exit(ok ? 0 : 1);
