# A new repository, in TypeScript only

## Decision

- Pato starts in a new repository instead of growing out of `puddles`.
- The game and its tools are TypeScript, in one package at the root, run with pnpm.
- There is no Python until phase 7 brings real senses. The language-model planner talks to a local OpenAI-compatible server over HTTP, so it needs none.
- Content files are JSON, checked by hand-written validators.

## Why

- `puddles` is built around reactions to held-up objects. Its central contract, its skills and its learning all assume the duck reacts. Pato's duck acts on its own, in a world that changes, which is a different centre.
- Staying on TypeScript lets the clock, event log, executor, simulated kid and bandit port almost directly.
- One language and one package keep the gates small while most of the work is headless simulation.

## Rejected

- **Reshaping puddles in place.** Its history and gates are good, but every contract would change, and its own tooling would resist the changes.
- **A game engine.** Rendering is the smallest part. The value is in the simulation, which must run headless.
- **YAML for content.** It reads a little better and needs a dependency.
