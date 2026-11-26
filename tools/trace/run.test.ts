import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runTrace } from "./run.ts";

const PRD = "- **R-01** (phase 2): Something.";
const SPEC = "- **S-A-1** (R-01, phase 1): First.\n- **S-A-2** (R-01, phase 2): Second.";
const EVALS = "**E-01** (S-A-2, phase 2): A scenario.";

/** A repository on disk with the given files. */
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "trace-"));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const docs = (phase: string): Record<string, string> => ({
  "docs/prd.md": PRD,
  "docs/spec.md": SPEC,
  "docs/evals.md": EVALS,
  "docs/phase.json": phase,
});

describe("runTrace", () => {
  it("passes consistent docs and shows progress", () => {
    const run = runTrace(repo(docs('{"current": 1}')));
    expect(run).toEqual({
      ok: true,
      lines: ["phase 1: 0/1 tested  <- current", "phase 2: 0/2 tested"],
    });
  });

  it("reads tests under src, in nested folders", () => {
    const root = repo({
      ...docs('{"current": 1}'),
      "src/kernel/clock.test.ts": 'it("[S-A-1] ticks", () => {});',
      "src/kernel/clock.ts": "export const tick = 1;",
    });
    expect(runTrace(root).lines[0]).toBe("phase 1: 1/1 tested  <- current");
  });

  it("fails when a passed phase has an untested item", () => {
    const run = runTrace(repo(docs('{"current": 2}')));
    expect(run.ok).toBe(false);
    expect(run.lines[0]).toBe(
      "docs/spec.md:1: phase-gap: S-A-1 belongs to a passed phase but no test cites it",
    );
  });

  it("names the file of a problem in a test", () => {
    const root = repo({ ...docs('{"current": 1}'), "src/a.test.ts": 'it("adds", () => {});' });
    expect(runTrace(root).lines[0]).toBe(
      "src/a.test.ts:1: untagged-test: cite the spec item this tests",
    );
  });

  it("ignores tests outside src", () => {
    const root = repo({ ...docs('{"current": 1}'), "tools/a.test.ts": 'it("adds", () => {});' });
    expect(runTrace(root).ok).toBe(true);
  });

  it("fails when a doc is missing", () => {
    const run = runTrace(repo({ "docs/prd.md": PRD, "docs/phase.json": '{"current": 1}' }));
    expect(run.ok).toBe(false);
    expect(run.lines).toContain("docs/spec.md:1: missing-doc: docs/spec.md is missing");
  });

  it("fails when a doc has a malformed item", () => {
    const root = repo({ ...docs('{"current": 1}'), "docs/spec.md": `${SPEC}\n- **S-A-3** Oops.` });
    expect(runTrace(root).lines[0]).toContain("bad-item");
  });

  it.each(["{}", '{"current": "one"}', '{"current": 1.5}', '{"current": -1}'])(
    "fails on the phase file %s",
    (phase) => {
      const run = runTrace(repo(docs(phase)));
      expect(run.ok).toBe(false);
      expect(run.lines.at(-1)).toContain("bad-phase");
    },
  );

  it("fails when the phase file is missing", () => {
    const run = runTrace(
      repo({ "docs/prd.md": PRD, "docs/spec.md": SPEC, "docs/evals.md": EVALS }),
    );
    expect(run.lines.at(-1)).toContain("bad-phase");
  });

  it("lists what to build next when asked", () => {
    const run = runTrace(repo(docs('{"current": 2}')), 5);
    expect(run.lines.slice(-3)).toEqual([
      "next:",
      "S-A-2  Second.  (docs/spec.md:2)",
      "E-01  A scenario.  (docs/evals.md:1)",
    ]);
  });
});
