import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sources } from "../evals/sources.ts";

const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm;
const STRINGS = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

const stems = (folder: string): string[] =>
  readdirSync(`content/${folder}`).map((name) => name.replace(/\.json$/, ""));
const ids = [...stems("objects"), ...stems("creatures"), ...stems("scenarios")];
const code = sources().filter(({ path }) => !path.endsWith(".test.ts"));

/** Every string written in `text`, outside comments. */
const stringsIn = (text: string): string[] => text.replace(COMMENTS, "$1").match(STRINGS) ?? [];

describe("names in the code", () => {
  it("[S-OBJ-5] has no object, creature or scenario id in any string under src, outside tests", () => {
    const named = code.flatMap(({ path, text }) =>
      stringsIn(text)
        .filter((literal) => ids.some((id) => new RegExp(`\\b${id}\\b`).test(literal)))
        .map((literal) => `${path}: ${literal}`),
    );
    expect(ids.length).toBeGreaterThan(3);
    expect(named).toEqual([]);
  });

  it("[S-OBJ-5] would see an id in a string, and not in a comment", () => {
    const [id] = ids;
    expect(stringsIn(`const a = "x ${String(id)} y"; // "${String(id)}"`)).toEqual([
      `"x ${String(id)} y"`,
    ]);
  });
});
