---
name: next
description: Build the next untested spec item of the current phase, test first, and repeat until the phase is ready for its gate.
---

# Build the next spec item

Read `AGENTS.md` first if you have not this session.

1. Run `pnpm next`.
   - If it reports problems, fix those before anything else. They mean docs, tests and phase disagree.
   - If it says the phase is ready for its gate, stop. Report the phase, paste the output of `pnpm check`, and list anything in `docs/phases.md` that the gate needs from the owner.
2. Take the first item listed. Open `docs/spec.md` at the line it gives and read the whole section, then the requirement it names in `docs/prd.md`.
3. If the item is a scenario (`E-NN`), read it in `docs/evals.md` and take every number from `evals/thresholds.json`.
4. Write a test that cites the item in its title, such as `it("[S-TICK-3] derives each stream from the seed", ...)`. Run it and see it fail for the right reason.
5. Write the least code that passes. Put it where `docs/spec.md` (Layout) says that kind of code lives.
6. Run `pnpm check`. Fix until green. Never fix a failure by weakening the check.
7. Commit with one short line saying what now works.
8. Go to step 1.

Stop and ask when `AGENTS.md` says to. Never add the `owner-approved` label, change `docs/phase.json`, or edit a protected path.
