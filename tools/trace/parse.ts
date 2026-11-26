/**
 * Reads the numbered items out of the PRD, the spec and the evals doc. An item is one line:
 *
 *   - **S-FACT-3** (R-10, phase 1): A fact leaves belief once it expires.
 *
 * The brackets hold the ids it points back to and its phase (or `deferred`).
 */

export type Kind = "R" | "S" | "E";

export interface Item {
  readonly id: string;
  readonly kind: Kind;
  /** A spec item's requirements, or a scenario's spec items. */
  readonly refs: readonly string[];
  readonly phase: number | "deferred";
  readonly text: string;
  readonly file: string;
  readonly line: number;
}

export interface Problem {
  readonly rule: string;
  readonly message: string;
  readonly file: string;
  readonly line: number;
}

export interface Parsed {
  readonly items: readonly Item[];
  readonly problems: readonly Problem[];
}

/** Matches one id; shared with the test scanner so both read ids the same way. */
export const ID_PATTERN = "(?:[RE]-\\d+|S-[A-Z]+-\\d+)";

const ONE_ID = new RegExp(`^${ID_PATTERN}$`);
const STARTS_WITH_ID = new RegExp(`^(?:[-*] )?\\*\\*(${ID_PATTERN})\\*\\*`);
const ITEM = new RegExp(`^(?:[-*] )?\\*\\*(${ID_PATTERN})\\*\\* \\(([^)]*)\\): (.+)$`);
const FENCE = /^\s*```/;

interface Meta {
  readonly refs: readonly string[];
  readonly phase: number | "deferred" | undefined;
  readonly bad: readonly string[];
}

function readMeta(meta: string): Meta {
  const refs: string[] = [];
  const bad: string[] = [];
  let phase: number | "deferred" | undefined;
  for (const token of meta.split(",").map((part) => part.trim())) {
    const numbered = /^phase (\d+)$/.exec(token);
    if (numbered) phase = Number(numbered[1]);
    else if (token === "deferred") phase = "deferred";
    else if (ONE_ID.test(token)) refs.push(token);
    else bad.push(token);
  }
  return { refs, phase, bad };
}

function kindOf(id: string): Kind {
  if (id.startsWith("R")) return "R";
  return id.startsWith("S") ? "S" : "E";
}

function readLine(text: string, file: string, line: number): Item | Problem | null {
  const id = STARTS_WITH_ID.exec(text)?.[1];
  if (id === undefined) return null;
  const problem = (message: string): Problem => ({ rule: "bad-item", message, file, line });
  const match = ITEM.exec(text);
  if (!match) return problem(`${id} must read "**${id}** (refs, phase N): text"`);
  const { refs, phase, bad } = readMeta(match[2] ?? "");
  if (bad.length > 0) return problem(`${id} has unreadable brackets: ${bad.join(", ")}`);
  if (phase === undefined) return problem(`${id} needs "phase N" or "deferred"`);
  return { id, kind: kindOf(id), refs, phase, text: match[3] ?? "", file, line };
}

/** The items in one markdown file, skipping fenced code so examples don't count. */
export function parseDoc(markdown: string, file: string): Parsed {
  const items: Item[] = [];
  const problems: Problem[] = [];
  let fenced = false;
  markdown.split("\n").forEach((text, index) => {
    if (FENCE.test(text)) fenced = !fenced;
    if (fenced) return;
    const read = readLine(text, file, index + 1);
    if (!read) return;
    if ("rule" in read) problems.push(read);
    else items.push(read);
  });
  return { items, problems };
}
