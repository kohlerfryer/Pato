/** Objects are data: one file each in `content/objects/`, found by the loader and nowhere else. */

import { fieldsProblem, isPositive, isRecord, readFiles } from "./check.ts";

export interface ObjectDef {
  /** The file's name, without `.json`. */
  readonly id: string;
  /** Which of its properties can be seen at a glance. */
  readonly looks: readonly string[];
  /** What it is like. Behaviour comes from these, through each property's rule. */
  readonly props: Readonly<Record<string, boolean | number | string>>;
  /** Its width along the ground and its height, seen from the side. */
  readonly size: { readonly width: number; readonly height: number };
  /** What using it does, beyond what its properties already do. */
  readonly use?: unknown;
}

const isPlain = (value: unknown): boolean =>
  typeof value === "boolean" || typeof value === "number" || typeof value === "string";

function propsProblem(props: unknown, looks: unknown): string | null {
  if (!isRecord(props) || !Object.values(props).every(isPlain))
    return "props must map names to true or false, a number or text";
  const seen = Array.isArray(looks) && looks.every((name) => Object.hasOwn(props, String(name)));
  return seen ? null : "looks must list names from props";
}

function objectProblem(value: unknown, stem: string): string | null {
  if (!isRecord(value)) return "must be an object";
  const fields = fieldsProblem(value, ["id", "looks", "props", "size"], ["use"]);
  if (fields !== null) return fields;
  if (value.id !== stem) return `id must be "${stem}", the file's name`;
  const { size } = value;
  if (!isRecord(size) || !isPositive(size.width) || !isPositive(size.height))
    return "size needs a width and a height above zero";
  return propsProblem(value.props, value.looks);
}

/** Checks each object file. Throws on the first bad one, naming it. */
export function readObjects(files: Readonly<Record<string, unknown>>): ObjectDef[] {
  return readFiles<ObjectDef>(files, objectProblem);
}

/** Every object in `content/objects/`. Adding a file there is all it takes to add an object. */
export function loadObjects(): ObjectDef[] {
  return readObjects(
    import.meta.glob("../../content/objects/*.json", { eager: true, import: "default" }),
  );
}
