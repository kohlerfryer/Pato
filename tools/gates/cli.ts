/**
 * `pnpm gates [base]` checks this branch's changes against `base` (default `origin/main`).
 * Set OWNER_APPROVED=true when the pull request carries the owner's label.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { gateProblems, parseChanges } from "./gates.ts";

const base = process.argv[2] ?? "origin/main";
const diff = execFileSync("git", ["diff", "--name-status", `${base}...HEAD`], { encoding: "utf8" });
const problems = gateProblems({
  changes: parseChanges(diff),
  codeowners: readFileSync(".github/CODEOWNERS", "utf8"),
  ownerApproved: process.env.OWNER_APPROVED === "true",
});
console.log(problems.length > 0 ? problems.join("\n") : "gates: ok");
process.exit(problems.length > 0 ? 1 : 0);
