/** Reads which spec items and scenarios a test file cites, and whether any test in it is switched off. */

import { ID_PATTERN } from "./parse.ts";

interface Tag {
  readonly id: string;
  readonly line: number;
}

export interface TestFile {
  readonly file: string;
  /** Ids cited as `[S-FACT-3]` or `[E-02]`, usually in a test's title. */
  readonly tags: readonly Tag[];
  /** Lines with `.skip`, `.only` or `.todo`: such tests prove nothing. */
  readonly disabled: readonly number[];
}

const TAG = new RegExp(`\\[(${ID_PATTERN})\\]`, "g");
const DISABLED = /\b(?:it|test|describe)\.(?:skip|only|todo)\b/;

export function scanTest(source: string, file: string): TestFile {
  const tags: Tag[] = [];
  const disabled: number[] = [];
  source.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(TAG)) tags.push({ id: match[1] ?? "", line: index + 1 });
    if (DISABLED.test(text)) disabled.push(index + 1);
  });
  return { file, tags, disabled };
}
