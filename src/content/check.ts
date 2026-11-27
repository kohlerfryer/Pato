/** Small checks shared by the content loaders, which read data files written by hand. */

declare global {
  interface ImportMeta {
    /** Vite's way to load every file matching a pattern, known at build time. */
    glob(pattern: string, options: { eager: true; import: "default" }): Record<string, unknown>;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPositive(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

/** Why `value`'s fields are wrong, or null: it must have every required one and no unknown ones. */
export function fieldsProblem(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): string | null {
  const missing = required.find((name) => !Object.hasOwn(value, name));
  if (missing !== undefined) return `is missing "${missing}"`;
  const unknown = Object.keys(value).find(
    (name) => !required.includes(name) && !optional.includes(name),
  );
  return unknown === undefined ? null : `has a field it shouldn't, "${unknown}"`;
}

/** Reads every data file in `files`, in name order. Throws on the first bad one, naming it. */
export function readFiles<T>(
  files: Readonly<Record<string, unknown>>,
  problemIn: (value: unknown, stem: string) => string | null,
): T[] {
  return Object.keys(files)
    .sort()
    .map((path) => {
      const stem = (path.split("/").at(-1) ?? path).replace(/\.json$/, "");
      const problem = problemIn(files[path], stem);
      if (problem !== null) throw new Error(`${path}: ${problem}`);
      return files[path] as T;
    });
}
