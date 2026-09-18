import { describe, expect, it } from "vitest";
import { classifyPatchLines, isBinaryPatch, parseHunkHeader, splitPatch } from "./patch";

const PATCH = [
  "diff --git a/a.txt b/a.txt",
  "index 1111111..2222222 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,3 +1,3 @@",
  " uno",
  "-dos",
  "+tres",
  " cuatro",
  "",
].join("\n");

const BINARY = [
  "diff --git a/bin.bin b/bin.bin",
  "index 1111111..2222222 100644",
  "Binary files a/bin.bin and b/bin.bin differ",
  "",
].join("\n");

describe("splitPatch", () => {
  it("separa las dos versiones de un parche unificado", () => {
    const split = splitPatch(PATCH);

    expect(split).toEqual({
      original: "uno\ndos\ncuatro",
      modified: "uno\ntres\ncuatro",
      hunks: 1,
    });
  });

  it("reconoce binarios y devuelve null", () => {
    expect(isBinaryPatch(BINARY)).toBe(true);
    expect(splitPatch(BINARY)).toBeNull();
  });

  it("ignora cabeceras y marcadores de fin de fichero", () => {
    const patch = [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1 +1 @@",
      "-viejo",
      "\\ No newline at end of file",
      "+nuevo",
      "\\ No newline at end of file",
      "",
    ].join("\n");

    const split = splitPatch(patch);

    expect(split?.original).toBe("viejo");
    expect(split?.modified).toBe("nuevo");
  });

  it("devuelve null cuando no hay hunks", () => {
    const patch = ["diff --git a/a b/a", "old mode 100644", "new mode 100755", ""].join("\n");
    expect(splitPatch(patch)).toBeNull();
    expect(splitPatch("")).toBeNull();
  });

  it("clasifica las líneas del parche para la vista de staging", () => {
    const lines = classifyPatchLines(PATCH);

    expect(lines.map((line) => line.type)).toEqual([
      "meta",
      "meta",
      "meta",
      "meta",
      "hunk",
      "context",
      "del",
      "add",
      "context",
    ]);
    expect(lines[5].index).toBe(5);
    expect(lines[6].index).toBe(6);
    expect(lines[8].hunk).toBe(0);
  });

  it("numera las líneas antiguas y nuevas de cada tipo", () => {
    const lines = classifyPatchLines(PATCH);

    const hunk = lines.find((line) => line.type === "hunk")!;
    expect(hunk.oldLine).toBeNull();
    expect(hunk.newLine).toBeNull();

    // contexto: numeran en ambas versiones
    expect(lines[5]).toMatchObject({ type: "context", oldLine: 1, newLine: 1 });
    // borrada: solo antigua
    expect(lines[6]).toMatchObject({ type: "del", oldLine: 2, newLine: null });
    // añadida: solo nueva
    expect(lines[7]).toMatchObject({ type: "add", oldLine: null, newLine: 2 });
    // contexto tras el cambio: la nueva avanza por el añadido
    expect(lines[8]).toMatchObject({ type: "context", oldLine: 3, newLine: 3 });
  });

  it("acepta cabeceras con conteos implícitos y sección", () => {
    expect(parseHunkHeader("@@ -1 +1 @@")).toEqual({
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      section: "",
    });
    expect(parseHunkHeader("@@ -10,0 +12,4 @@ function ejemplo()")).toEqual({
      oldStart: 10,
      oldCount: 0,
      newStart: 12,
      newCount: 4,
      section: "function ejemplo()",
    });
    expect(parseHunkHeader("no es una cabecera")).toBeNull();
  });

  it("no confunde líneas de contenido que empiezan por guiones", () => {
    const patch = [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1 +1 @@",
      "--- texto que empieza con guiones",
      "+++ texto que empieza con mas",
      "",
    ].join("\n");

    const split = splitPatch(patch);
    expect(split?.original).toBe("-- texto que empieza con guiones");
    expect(split?.modified).toBe("++ texto que empieza con mas");
  });
});
