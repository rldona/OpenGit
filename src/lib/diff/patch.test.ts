import { describe, expect, it } from "vitest";
import { isBinaryPatch, splitPatch } from "./patch";

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
