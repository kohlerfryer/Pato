import { describe, expect, it } from "vitest";

import {
  gateProblems,
  isProtected,
  parseChanges,
  protectedPaths,
  untestedSources,
} from "./gates.ts";

const CODEOWNERS = [
  "# Paths only the owner changes.",
  "",
  "/.github/            @owner",
  "/docs/spec.md        @owner",
  "/evals/thresholds.json @owner",
].join("\n");

describe("parseChanges", () => {
  it("reads status and path", () => {
    expect(parseChanges("M\tsrc/a.ts\nA\tsrc/a.test.ts\n")).toEqual([
      { status: "M", path: "src/a.ts" },
      { status: "A", path: "src/a.test.ts" },
    ]);
  });

  it("counts both sides of a rename", () => {
    expect(parseChanges("R100\tdocs/spec.md\tdocs/old.md")).toEqual([
      { status: "R", path: "docs/spec.md" },
      { status: "R", path: "docs/old.md" },
    ]);
  });

  it("reads an empty diff as no changes", () => {
    expect(parseChanges("\n")).toEqual([]);
  });
});

describe("protectedPaths", () => {
  it("reads paths, dropping comments, blanks, owners and the leading slash", () => {
    expect(protectedPaths(CODEOWNERS)).toEqual([
      ".github/",
      "docs/spec.md",
      "evals/thresholds.json",
    ]);
  });
});

describe("isProtected", () => {
  const patterns = protectedPaths(CODEOWNERS);

  it("protects everything under a listed folder", () => {
    expect(isProtected(".github/workflows/ci.yml", patterns)).toBe(true);
  });

  it("protects a listed file exactly", () => {
    expect(isProtected("docs/spec.md", patterns)).toBe(true);
    expect(isProtected("docs/spec.md.bak", patterns)).toBe(false);
  });

  it("leaves other paths alone", () => {
    expect(isProtected("docs/decisions/0003-x.md", patterns)).toBe(false);
  });
});

describe("untestedSources", () => {
  it("lists changed source when no test changed", () => {
    expect(untestedSources(parseChanges("M\tsrc/b.ts\nA\tsrc/a.ts\nM\tREADME.md"))).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("is satisfied by any changed test", () => {
    expect(untestedSources(parseChanges("M\tsrc/a.ts\nM\tsrc/a.test.ts"))).toEqual([]);
  });

  it("ignores deleted source and files that aren't code", () => {
    expect(untestedSources(parseChanges("D\tsrc/a.ts\nM\tcontent/objects/house.json"))).toEqual([]);
  });

  it("covers the tools as well as the game", () => {
    expect(untestedSources(parseChanges("M\ttools/trace/check.ts"))).toEqual([
      "tools/trace/check.ts",
    ]);
  });
});

describe("gateProblems", () => {
  const changes = parseChanges("M\tdocs/spec.md\nM\tsrc/a.ts\nM\tsrc/a.test.ts");

  it("blocks a protected path without the owner's label", () => {
    expect(gateProblems({ changes, codeowners: CODEOWNERS, ownerApproved: false })).toEqual([
      "docs/spec.md: protected-path: needs the owner-approved label from the owner",
    ]);
  });

  it("lets a protected path through with the owner's label", () => {
    expect(gateProblems({ changes, codeowners: CODEOWNERS, ownerApproved: true })).toEqual([]);
  });

  it("still asks for tests when the owner approved", () => {
    const untested = parseChanges("M\tdocs/spec.md\nM\tsrc/a.ts");
    expect(
      gateProblems({ changes: untested, codeowners: CODEOWNERS, ownerApproved: true }),
    ).toEqual(["src/a.ts: tests-touched: source changed but no test changed in this branch"]);
  });

  it("names a renamed protected file once", () => {
    const renamed = parseChanges("R100\tdocs/spec.md\tdocs/spec.md");
    expect(
      gateProblems({ changes: renamed, codeowners: CODEOWNERS, ownerApproved: false }),
    ).toHaveLength(1);
  });
});
