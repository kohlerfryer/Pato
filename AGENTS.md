# AGENTS.md

Pato is a small 2D world with a duck that has its own drives, explores what appears, and learns what it can do and what makes kids laugh. You are building it against a written spec, one tested item at a time.

## The three documents

- [`docs/prd.md`](docs/prd.md): what must be true. Requirements `R-NN`.
- [`docs/spec.md`](docs/spec.md): how it is built. Spec items `S-AREA-N`, each one testable statement that names the requirements it serves.
- [`docs/evals.md`](docs/evals.md): how it is proven. Scenarios `E-NN`, each naming the spec items it checks.

`docs/phase.json` holds the phase being built. [`docs/phases.md`](docs/phases.md) says what each phase delivers and what its gate is.

## The loop

1. Run `pnpm next`. It lists the untested spec items of the current phase, in order.
2. Take the first one. Read its section of the spec and the requirement it serves.
3. Write a failing test that cites it in the title: `it("[S-FACT-3] drops a fact after its ttl", ...)`.
4. Write the least code that makes it pass.
5. Run `pnpm check`. Fix until it is green.
6. Commit: one short line saying what now works. Then go back to step 1.

When `pnpm next` says the phase is ready for its gate, stop and report. Only the owner passes a gate.

`.claude/skills/next/SKILL.md` has this loop as a skill.

## Rules

- **Test first.** No code without a failing test that cites a spec item. Every test file under `src/` cites at least one.
- **Stay in the spec.** If the work needs behaviour no item describes, stop and propose the item in `docs/decisions/`. Don't build it and explain later.
- **Never weaken a check.** Don't edit thresholds, the spec, the evals, the tools, lint or coverage settings, or CI. Don't skip, focus or `todo` a test. If a criterion looks wrong, report the number and stop.
- **No names.** Never branch on an object, creature, scenario or persona id. Behaviour belongs to properties.
- **The trace is the interface.** Evals read the trace only. The planner and the agent never import the world.
- **Evidence, not claims.** "Done" means `pnpm check` passed. Paste its last lines.
- **Smallest thing that works.** No speculative options, no dead or commented-out code, no `TODO` without an issue. Match the patterns already in the file.
- **No new dependency** without the owner's approval. Ask first.

## Protected paths

`.github/CODEOWNERS` lists the files that define "correct": the three documents, `docs/phase.json`, `evals/thresholds.json`, `tools/`, the lint, type and test settings, and CI. A pull request that touches one fails the `pr gates` check until the owner adds the `owner-approved` label. Never add that label yourself.

Scenario tests under `src/evals/` and content under `content/` are yours to write. They must read every number from `evals/thresholds.json`.

## Trying a design idea

When there is more than one reasonable way to meet an item, or an eval fails and the fix is not obvious:

1. Write down the hypothesis and the measured value that should move, before any code.
2. Build two or three candidates, each behind the existing interface.
3. Run each against the same seeds as the current code.
4. Keep one only if it does better on at least 8 of 10 seeds and nothing else gets worse.
5. Record what was tried and the numbers in `docs/decisions/`, including what failed.

## When to stop and ask

- An item is unclear or two items conflict.
- The work needs something from a later phase or from "Later" in the PRD.
- `pnpm check` has failed three times on the same problem.
- A change would touch a protected path.
- A diff passes 400 lines, not counting tests.

Say what you need in one or two sentences.

## Commands

```bash
pnpm install     # dependencies, from the lockfile
pnpm check       # every gate; CI runs the same thing
pnpm next        # the current phase's untested items
pnpm trace       # docs, tests and phase checked against each other
pnpm test        # tests with coverage thresholds
pnpm format      # fix formatting
pnpm gates       # what the pull request checks will say about this branch
```

## Limits

Enforced by `pnpm check`. They only get stricter.

| Check       | Limit                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Format      | prettier, no diff                                                            |
| Lint        | typescript-eslint strict and stylistic, type-checked, 0 warnings             |
| Types       | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any` |
| Complexity  | 10 cyclomatic, 15 cognitive, per function                                    |
| Size        | 50 lines per function, 300 per file, 4 parameters, 3 levels of nesting       |
| Coverage    | 85% of lines, branches, functions and statements                             |
| Dead code   | knip: no unused files, exports or dependencies                               |
| Duplication | jscpd: 3% at most                                                            |
| Trace       | every link between requirements, spec, scenarios and tests holds             |

A lint suppression must name its rule and give a reason.

## Commits and pull requests

- Branch from `main`. Never push to `main`.
- One short line per commit, saying what now works. Every commit passes `pnpm check`.
- A pull request lists the spec items it adds tests for and pastes the tail of `pnpm check`.
