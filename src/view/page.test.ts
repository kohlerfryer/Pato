import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type Source, importsOf, sources } from "../evals/sources.ts";

const ENTRY = "src/web/main.ts";
const WEB = "src/web/";
const NODE_IMPORT = /from\s+"node:/;
const PAGE_THINGS =
  /\b(?:document|window|navigator|location)\.|\b(?:requestAnimationFrame|HTMLCanvasElement|CanvasRenderingContext2D)\b/;

const all = sources();
const byPath = new Map(all.map((source) => [source.path, source]));

/** Every source file the entry pulls in, directly or through others. */
function loadedBy(entry: string): Source[] {
  const seen = new Set<string>();
  const queue = [entry];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    const source = byPath.get(path);
    if (!source || seen.has(path)) continue;
    seen.add(path);
    queue.push(...importsOf(source));
  }
  return all.filter(({ path }) => seen.has(path));
}

describe("the page", () => {
  const loaded = loadedBy(ENTRY);

  it("[S-DRAW-5] is started by the entry file the site's index names", () => {
    expect(readFileSync("index.html", "utf8")).toContain(`/${ENTRY}`);
    expect(loaded.map(({ path }) => path)).toContain(ENTRY);
  });

  it("[S-DRAW-5] loads nothing that imports a Node built-in", () => {
    expect(loaded.length).toBeGreaterThan(15);
    expect(loaded.filter(({ text }) => NODE_IMPORT.test(text)).map(({ path }) => path)).toEqual([]);
  });

  it("[S-DRAW-5] leaves out the code that does need Node, such as the report writer", () => {
    const needsNode = all.filter(({ text }) => NODE_IMPORT.test(text)).map(({ path }) => path);
    expect(needsNode).toContain("src/evals/report.ts");
    expect(loaded.map(({ path }) => path).filter((path) => needsNode.includes(path))).toEqual([]);
  });

  it("[S-DRAW-6] is the only code that touches the page or its canvas", () => {
    const touching = all.filter(({ text }) => PAGE_THINGS.test(text)).map(({ path }) => path);
    expect(touching.filter((path) => !path.startsWith(WEB))).toEqual([]);
    expect(touching).toContain(ENTRY);
  });

  it("[S-DRAW-6] is imported by no code outside src/web", () => {
    const importers = all
      .filter(({ path }) => !path.startsWith(WEB))
      .filter((source) => importsOf(source).some((target) => target.startsWith(WEB)))
      .map(({ path }) => path);
    expect(importers).toEqual([]);
  });
});
