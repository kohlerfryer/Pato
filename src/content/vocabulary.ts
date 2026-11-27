/** The words the world is described in. A predicate does nothing until a rule, a drive or a skill uses it. */

import vocabulary from "../../content/vocabulary.json";
import { fieldsProblem, isRecord } from "./check.ts";

type Meanings = Readonly<Record<string, string>>;

interface Vocabulary {
  /** What an object can be like. */
  readonly properties: Meanings;
  /** How an agent can stand to something else. */
  readonly relations: Meanings;
  /** What an agent can sense about itself. */
  readonly states: Meanings;
}

const SECTIONS = ["properties", "relations", "states"] as const;

const isMeaning = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "" && !value.includes("\n");

function vocabularyProblem(value: unknown): string | null {
  if (!isRecord(value)) return "must be an object";
  const fields = fieldsProblem(value, SECTIONS);
  if (fields !== null) return fields;
  const bad = SECTIONS.find((name) => {
    const section = value[name];
    return !isRecord(section) || !Object.values(section).every(isMeaning);
  });
  return bad === undefined ? null : `${bad} must give each name a one-line meaning`;
}

/** Checks a vocabulary. Throws if it is malformed. */
export function readVocabulary(value: unknown): Vocabulary {
  const problem = vocabularyProblem(value);
  if (problem !== null) throw new Error(`vocabulary: ${problem}`);
  return value as Vocabulary;
}

/** The vocabulary in `content/vocabulary.json`. */
export function loadVocabulary(): Vocabulary {
  return readVocabulary(vocabulary);
}

/** Every predicate the vocabulary lists, whichever section it is in. */
export function knownPredicates(words: Vocabulary): ReadonlySet<string> {
  return new Set(SECTIONS.flatMap((name) => Object.keys(words[name])));
}
