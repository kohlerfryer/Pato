# Pato

A small 2D world with a duck that has its own drives, explores whatever appears, and learns what it can do and what makes kids laugh. Nothing it does with a specific object is scripted, and it runs on one laptop.

Status: phase 2 of 7. See [`docs/phases.md`](docs/phases.md).

## Read first

- [`docs/prd.md`](docs/prd.md): what must be true
- [`docs/spec.md`](docs/spec.md): how it is built, as numbered testable items
- [`docs/evals.md`](docs/evals.md): the eleven scenarios that prove it
- [`AGENTS.md`](AGENTS.md): how work is done here

## Run

```bash
pnpm install
pnpm check   # every gate
pnpm next    # what to build next
```

Needs pnpm and a Node that runs TypeScript files directly. It is developed on Node 22.23, and CI uses Node 26.

## How it stays in line

Every requirement is answered by spec items, every spec item is proven by a test that cites it, and `pnpm trace` checks those links. A phase can't be passed while any of its items lacks a test. The files that define "correct" change only with the owner's approval.
