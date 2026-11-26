# Every test cites a spec item

## Decision

- Requirements (`R-NN`), spec items (`S-AREA-N`) and scenarios (`E-NN`) are numbered lines in three markdown files. Those files are the source of truth, with no separate tracking file.
- A test proves an item by citing its id in the title. Every test file under `src/` cites at least one.
- `pnpm trace` checks that every spec item serves a requirement, every scheduled requirement has a spec item, every scenario checks spec items, every cited id exists, no test is switched off, and no item of a passed phase lacks a test.
- `docs/phase.json` holds the phase being built. Only the owner raises it.
- The files that define "correct" are listed in `.github/CODEOWNERS`. A pull request touching one fails until the owner labels it `owner-approved`.

## Why

- An autonomous builder drifts. It adds things nobody asked for and quietly drops things that are hard. Links checked by a tool catch both: untested items show up as work left, and code with no item to cite has no test to stand on.
- The next task is always computable, so the builder never has to decide what to do, only how.
- Keeping ids in the prose means the document a person reads is the document the tool checks.

## Limits

- A cited test can still prove less than its item says. The adversarial review at each gate is what catches that.
- The label is a tripwire, not a lock, while the builder and the owner share one GitHub identity. A branch ruleset requiring code-owner review, with the builder running as a separate identity, would make it a lock.

## Rejected

- **A tracking spreadsheet or issue per item.** A second copy drifts from the first.
- **Per-test tags enforced by parsing test titles.** Fragile with parameterised tests. File-level citation plus per-item coverage is enough.
