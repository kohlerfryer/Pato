/** Reads the game's own source, for checks on what the code may contain or import. */

import { readFileSync, readdirSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(SRC, "..");

export interface Source {
  /** From the repository root, such as `src/kernel/clock.ts`. */
  readonly path: string;
  readonly text: string;
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return files(path);
      return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
    })
    .sort();
}

/** Every TypeScript file under `src/` that is not a test. */
export function sources(): Source[] {
  return files(SRC).map((path) => ({
    path: relative(ROOT, path).split("\\").join("/"),
    text: readFileSync(path, "utf8"),
  }));
}

/** A relative import in any of its forms: `from "./x"`, `import "./x"` or `import("./x")`. */
const RELATIVE_IMPORT = /(?:from\s+|import\s*\(?\s*)"(\.[^"]*)"/g;

/** The files `source` imports from this repository, as repository paths. */
export function importsOf({ path, text }: Source): string[] {
  return [...text.matchAll(RELATIVE_IMPORT)].map((match) =>
    posix.join(posix.dirname(path), match[1] ?? ""),
  );
}
