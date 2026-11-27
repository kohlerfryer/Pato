import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadObjects, readObjects } from "./objects.ts";

const crate = {
  id: "crate",
  looks: ["grabbable"],
  props: { grabbable: true, weight: 3 },
  footprint: { width: 1, depth: 1 },
};
const file = "content/objects/crate.json";
const reading =
  (object: unknown, path = file) =>
  (): unknown =>
    readObjects({ [path]: object });

describe("readObjects", () => {
  it("[S-OBJ-1] reads an object with an id, looks, props and a footprint", () => {
    expect(readObjects({ [file]: crate })).toEqual([crate]);
  });

  it("[S-OBJ-1] reads an object that also says what using it does", () => {
    const withUse = { ...crate, use: { toggle: "open" } };
    expect(readObjects({ [file]: withUse })).toEqual([withUse]);
  });

  it("[S-OBJ-1] stops the load on a bad file and names it", () => {
    expect(reading({ ...crate, footprint: { width: 0, depth: 1 } })).toThrow(file);
  });

  it.each([
    ["something that isn't an object", ["crate"]],
    ["a missing field", { id: "crate", looks: [], props: {} }],
    ["a field it doesn't know", { ...crate, colour: "red" }],
    ["an id that isn't the file's name", { ...crate, id: "box" }],
    ["props that aren't plain values", { ...crate, props: { grabbable: { very: true } } }],
    ["looks that aren't among its props", { ...crate, looks: ["soft"] }],
    ["looks that aren't a list", { ...crate, looks: "grabbable" }],
    ["a footprint with no size", { ...crate, footprint: { width: 1 } }],
    ["a footprint that isn't an object", { ...crate, footprint: 2 }],
  ])("[S-OBJ-1] refuses %s", (_what, object) => {
    expect(reading(object)).toThrow(file);
  });

  it("[S-OBJ-1] reads files in name order, whatever order they come in", () => {
    const box = { ...crate, id: "box" };
    const read = readObjects({ [file]: crate, "content/objects/box.json": box });
    expect(read.map((object) => object.id)).toEqual(["box", "crate"]);
  });
});

describe("loadObjects", () => {
  it("[S-OBJ-2] loads every file in content/objects, and only those", () => {
    const onDisk = readdirSync("content/objects").map((name) => name.replace(/\.json$/, ""));
    expect(loadObjects().map((object) => object.id)).toEqual(onDisk.sort());
    expect(onDisk.length).toBeGreaterThan(0);
  });
});
