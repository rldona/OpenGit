import { describe, expect, it } from "vitest";
import { conflictCount, parseConflictBlocks, resolvedContent } from "./parse";

const MERGE_STYLE = [
  "linea comun",
  "<<<<<<< HEAD",
  "nuestra linea",
  "=======",
  "su linea",
  ">>>>>>> feature",
  "final comun",
  "",
].join("\n");

const DIFF3 = [
  "<<<<<<< HEAD",
  "nuestra",
  "||||||| base",
  "original",
  "=======",
  "suya",
  ">>>>>>> feature",
  "",
].join("\n");

describe("parseConflictBlocks", () => {
  it("parsea un conflicto estilo merge", () => {
    const blocks = parseConflictBlocks(MERGE_STYLE);

    expect(blocks).toHaveLength(3);
    expect(conflictCount(blocks)).toBe(1);
    const conflict = blocks[1];
    if (conflict.kind !== "conflict") throw new Error("esperaba conflicto");
    expect(conflict.ours).toEqual(["nuestra linea"]);
    expect(conflict.theirs).toEqual(["su linea"]);
    expect(conflict.base).toBeNull();
    expect(conflict.oursLabel).toBe("HEAD");
    expect(conflict.theirsLabel).toBe("feature");
  });

  it("parsea diff3 con base", () => {
    const blocks = parseConflictBlocks(DIFF3);
    const conflict = blocks[0];
    if (conflict.kind !== "conflict") throw new Error("esperaba conflicto");
    expect(conflict.base).toEqual(["original"]);
  });

  it("soporta varios conflictos y contenido sin marcadores", () => {
    const content = `${MERGE_STYLE}\notra comun\n${DIFF3}`;
    const blocks = parseConflictBlocks(content);
    expect(conflictCount(blocks)).toBe(2);

    expect(conflictCount(parseConflictBlocks("sin conflictos\n"))).toBe(0);
  });

  it("conserva el estado de la última línea", () => {
    expect(resolvedContent(parseConflictBlocks(MERGE_STYLE), { 0: "ours" }).content).toBe(
      "linea comun\nnuestra linea\nfinal comun\n",
    );
  });
});

describe("resolvedContent", () => {
  it("elige ours, theirs o ambos por bloque", () => {
    const blocks = parseConflictBlocks(MERGE_STYLE);

    expect(resolvedContent(blocks, { 0: "theirs" }).content).toBe(
      "linea comun\nsu linea\nfinal comun\n",
    );
    expect(resolvedContent(blocks, { 0: "both" }).content).toBe(
      "linea comun\nnuestra linea\nsu linea\nfinal comun\n",
    );
  });

  it("cuenta los bloques sin resolver", () => {
    const blocks = parseConflictBlocks(`${MERGE_STYLE}\notra\n${DIFF3}`);

    const partial = resolvedContent(blocks, { 0: "ours" });
    expect(partial.unresolved).toBe(1);
    expect(resolvedContent(blocks, { 0: "ours", 1: "theirs" }).unresolved).toBe(0);
  });
});
