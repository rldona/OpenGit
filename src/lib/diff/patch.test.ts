import { describe, expect, it } from "vitest";
import {
  classifyPatchLines,
  isBinaryPatch,
  parseHunkHeader,
  patchCounts,
  splitPatch,
  splitPatchByFile,
  stripPatchHeader,
} from "./patch";

describe("patchCounts", () => {
  it("counts added and deleted without counting ---/+++", () => {
    expect(patchCounts(PATCH)).toEqual({ added: 1, deleted: 1 });
  });

  it("a patch with no changes counts nothing", () => {
    expect(patchCounts("diff --git a/a b/a\n@@ -1 +1 @@\n mismo")).toEqual({
      added: 0,
      deleted: 0,
    });
  });
});

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
  it("splits the two versions of a unified patch", () => {
    const split = splitPatch(PATCH);

    expect(split).toEqual({
      original: "uno\ndos\ncuatro",
      modified: "uno\ntres\ncuatro",
      hunks: 1,
    });
  });

  it("recognizes binaries and returns null", () => {
    expect(isBinaryPatch(BINARY)).toBe(true);
    expect(splitPatch(BINARY)).toBeNull();
  });

  it("ignores headers and end-of-file markers", () => {
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

  it("returns null when there are no hunks", () => {
    const patch = ["diff --git a/a b/a", "old mode 100644", "new mode 100755", ""].join("\n");
    expect(splitPatch(patch)).toBeNull();
    expect(splitPatch("")).toBeNull();
  });

  it("classifies patch lines for the staging view", () => {
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

  it("numbers the old and new lines of each type", () => {
    const lines = classifyPatchLines(PATCH);

    const hunk = lines.find((line) => line.type === "hunk")!;
    expect(hunk.oldLine).toBeNull();
    expect(hunk.newLine).toBeNull();

    // context: numbered in both versions
    expect(lines[5]).toMatchObject({ type: "context", oldLine: 1, newLine: 1 });
    // deleted: old only
    expect(lines[6]).toMatchObject({ type: "del", oldLine: 2, newLine: null });
    // added: new only
    expect(lines[7]).toMatchObject({ type: "add", oldLine: null, newLine: 2 });
    // context after the change: the new side advances past the addition
    expect(lines[8]).toMatchObject({ type: "context", oldLine: 3, newLine: 3 });
  });

  it("accepts headers with implicit counts and section", () => {
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

  it("does not confuse content lines starting with dashes", () => {
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

describe("stripPatchHeader", () => {
  const PATCH = [
    "diff --git a/a.txt b/a.txt",
    "index 323a63d..b7ea4d8 100644",
    "--- a/a.txt",
    "+++ b/a.txt",
    "@@ -1,2 +1,3 @@",
    " uno",
    "+dos",
    " tres",
  ].join("\n");

  it("removes headers before the first hunk", () => {
    const lines = stripPatchHeader(classifyPatchLines(PATCH));

    expect(lines[0].type).toBe("hunk");
    expect(lines.some((line) => line.text.startsWith("diff --git"))).toBe(false);
    expect(lines.some((line) => line.text.startsWith("index "))).toBe(false);
    expect(lines.some((line) => line.text.startsWith("--- "))).toBe(false);
    expect(lines.some((line) => line.text.startsWith("+++ "))).toBe(false);
  });

  it("preserves the original indices, which are the ones staging uses", () => {
    const lines = stripPatchHeader(classifyPatchLines(PATCH));
    const added = lines.find((line) => line.type === "add");

    // "+dos" is line 6 (0-based) of the full patch, not line 1 of the rendered output.
    expect(added?.index).toBe(6);
    expect(added?.hunk).toBe(0);
  });

  it("splits a multi-file patch by `diff --git`", () => {
    const multi = [
      "diff --git a/uno.txt b/uno.txt",
      "index 111..222 100644",
      "--- a/uno.txt",
      "+++ b/uno.txt",
      "@@ -1 +1 @@",
      "-viejo",
      "+nuevo",
      "diff --git a/dir/dos.txt b/dir/dos.txt",
      "index 333..444 100644",
      "--- a/dir/dos.txt",
      "+++ b/dir/dos.txt",
      "@@ -1,2 +1,2 @@",
      " contexto",
      "-antes",
      "+después",
    ].join("\n");

    const files = splitPatchByFile(multi);

    expect(files.map((file) => file.path)).toEqual(["uno.txt", "dir/dos.txt"]);
    expect(files[0].patch).toContain("+nuevo");
    expect(files[0].patch).not.toContain("después");
    expect(files[1].patch).toContain("+después");
  });

  it("ignores text before the first `diff --git`", () => {
    expect(splitPatchByFile("ruido suelto\ndiff --git a/a b/a\n@@ -1 +1 @@\n-a\n+b")).toHaveLength(
      1,
    );
  });

  it("does not touch a patch that already starts at a hunk nor one without hunks", () => {
    const soloHunk = classifyPatchLines("@@ -1 +1 @@\n-a\n+b");
    expect(stripPatchHeader(soloHunk)).toHaveLength(soloHunk.length);

    const sinHunks = classifyPatchLines("Binary files a/x and b/x differ");
    expect(stripPatchHeader(sinHunks)).toHaveLength(sinHunks.length);
  });
});
