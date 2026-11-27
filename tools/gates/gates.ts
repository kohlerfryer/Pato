/**
 * Two checks on what a pull request changes: code must come with a test, and the files that
 * define "correct" (docs, thresholds, gates) change only with the owner's approval.
 */

export interface Change {
  /** Git's status letter: A, M, D, or R for a rename. */
  readonly status: string;
  readonly path: string;
}

const SOURCE_ROOTS = ["src/", "tools/"];
/** The page's own code draws on a canvas and has no unit tests; its logic lives in tested modules. */
const UNTESTED_ROOTS = ["src/web/"];

/** Reads `git diff --name-status`; a rename counts as a change to both its old and new path. */
export function parseChanges(nameStatus: string): Change[] {
  return nameStatus
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      const [code = "", ...paths] = line.split("\t");
      return paths.map((path) => ({ status: code.charAt(0), path }));
    });
}

/**
 * The paths listed in CODEOWNERS. Only the two forms this repo uses are understood: `/dir/` for
 * everything under a folder and `/file` for one file.
 */
export function protectedPaths(codeowners: string): string[] {
  return codeowners
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => (line.split(/\s+/)[0] ?? "").replace(/^\//, ""));
}

export function isProtected(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith("/") ? path.startsWith(pattern) : path === pattern,
  );
}

const isTest = (path: string): boolean => path.endsWith(".test.ts");

const isSource = (path: string): boolean =>
  SOURCE_ROOTS.some((root) => path.startsWith(root)) &&
  !UNTESTED_ROOTS.some((root) => path.startsWith(root)) &&
  path.endsWith(".ts") &&
  !isTest(path);

/** Source files changed in a pull request where no test changed at all. */
export function untestedSources(changes: readonly Change[]): string[] {
  if (changes.some((change) => isTest(change.path))) return [];
  return changes
    .filter((change) => change.status !== "D" && isSource(change.path))
    .map((change) => change.path)
    .sort();
}

export interface GateInputs {
  readonly changes: readonly Change[];
  readonly codeowners: string;
  /** Whether the owner has put the `owner-approved` label on the pull request. */
  readonly ownerApproved: boolean;
}

export function gateProblems({ changes, codeowners, ownerApproved }: GateInputs): string[] {
  const patterns = protectedPaths(codeowners);
  const touched = [...new Set(changes.map((change) => change.path))]
    .filter((path) => isProtected(path, patterns))
    .sort();
  return [
    ...untestedSources(changes).map(
      (path) => `${path}: tests-touched: source changed but no test changed in this branch`,
    ),
    ...(ownerApproved ? [] : touched).map(
      (path) => `${path}: protected-path: needs the owner-approved label from the owner`,
    ),
  ];
}
