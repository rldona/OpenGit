/**
 * Utilities to present the git patch. Git is the source of truth:
 * here the patch is only split into its two versions for side-by-side mode.
 */

export type SplitPatch = {
  original: string;
  modified: string;
  hunks: number;
};

/** Row height of the patch viewer (staging by hunks/lines). */
export const PATCH_ROW_HEIGHT = 20;

export type PatchLineType = "hunk" | "add" | "del" | "context" | "meta";

export type ClassifiedPatchLine = {
  /** Global index of the line within the patch (what the backend expects). */
  index: number;
  text: string;
  type: PatchLineType;
  hunk: number | null;
  /** Line number in the original version; `null` if it does not exist there. */
  oldLine: number | null;
  /** Line number in the new version; `null` if it does not exist there. */
  newLine: number | null;
};

export type HunkHeader = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  section: string;
};

/** Parses `@@ -a[,b] +c[,d] @@ section`; `null` if it does not match. */
export function parseHunkHeader(text: string): HunkHeader | null {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/.exec(text);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number.parseInt(match[1], 10),
    oldCount: match[2] === undefined ? 1 : Number.parseInt(match[2], 10),
    newStart: Number.parseInt(match[3], 10),
    newCount: match[4] === undefined ? 1 : Number.parseInt(match[4], 10),
    section: match[5] ?? "",
  };
}

/** Classifies patch lines to paint, select and number them. */
export function classifyPatchLines(patch: string): ClassifiedPatchLine[] {
  const raw = patch.split("\n");
  if (raw.length > 0 && raw[raw.length - 1] === "") {
    raw.pop();
  }
  let hunk = -1;
  let inHunk = false;
  let oldLine = 0;
  let newLine = 0;

  return raw.map((text, index) => {
    if (text.startsWith("@@")) {
      hunk += 1;
      inHunk = true;
      const header = parseHunkHeader(text);
      if (header) {
        oldLine = header.oldStart;
        newLine = header.newStart;
      }
      return { index, text, type: "hunk", hunk, oldLine: null, newLine: null };
    }
    if (!inHunk) {
      return { index, text, type: "meta", hunk: null, oldLine: null, newLine: null };
    }
    if (text.startsWith("+") && !text.startsWith("+++")) {
      const line = { index, text, type: "add" as const, hunk, oldLine: null, newLine };
      newLine += 1;
      return line;
    }
    if (text.startsWith("-") && !text.startsWith("---")) {
      const line = { index, text, type: "del" as const, hunk, oldLine, newLine: null };
      oldLine += 1;
      return line;
    }
    if (text.startsWith("\\")) {
      return { index, text, type: "meta", hunk, oldLine: null, newLine: null };
    }
    const line = { index, text, type: "context" as const, hunk, oldLine, newLine };
    oldLine += 1;
    newLine += 1;
    return line;
  });
}

export type FilePatch = {
  path: string;
  patch: string;
};

/** Path of the new file from `diff --git a/… b/…`. */
function pathFromDiffHeader(line: string): string {
  const rest = line.slice("diff --git ".length);
  const marker = rest.lastIndexOf(" b/");
  const path = marker >= 0 ? rest.slice(marker + 3) : rest;
  return path.replace(/^"|"$/g, "");
}

/**
 * Splits a multi-file patch into chunks by `diff --git`.
 * Used by the stash view, which receives the whole patch at once.
 */
export function splitPatchByFile(patch: string): FilePatch[] {
  const files: FilePatch[] = [];
  let lines: string[] | null = null;
  let path = "";

  const flush = () => {
    if (lines && lines.length > 0) {
      files.push({ path, patch: lines.join("\n") });
    }
  };

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      lines = [line];
      path = pathFromDiffHeader(line);
    } else if (lines) {
      lines.push(line);
    }
  }
  flush();
  return files;
}

/** Sum of added and deleted lines of a single-file patch. */
export function patchCounts(patch: string): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deleted += 1;
    }
  }
  return { added, deleted };
}

export function isBinaryPatch(patch: string): boolean {
  return patch
    .split("\n")
    .some((line) => line.startsWith("Binary files ") || line.startsWith("GIT binary patch"));
}

/**
 * Splits a unified patch into the original and modified text.
 * Returns `null` if there are no hunks (binary, file mode only or empty).
 */
export function splitPatch(patch: string): SplitPatch | null {
  if (patch.trim() === "" || isBinaryPatch(patch)) {
    return null;
  }
  const original: string[] = [];
  const modified: string[] = [];
  let hunks = 0;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      hunks += 1;
      continue;
    }
    if (hunks === 0) {
      // Headers (`diff --git`, `index`, `---`, `+++`, modes, rename...).
      continue;
    }
    if (line.startsWith("\\ No newline")) {
      continue;
    }
    if (line.startsWith("+")) {
      modified.push(line.slice(1));
      continue;
    }
    if (line.startsWith("-")) {
      original.push(line.slice(1));
      continue;
    }
    if (line.startsWith(" ")) {
      const text = line.slice(1);
      original.push(text);
      modified.push(text);
    }
  }

  if (hunks === 0) {
    return null;
  }
  return { original: original.join("\n"), modified: modified.join("\n"), hunks };
}

/**
 * Discards the patch headers before the first hunk
 * (`diff --git`, `index`, `---`, `+++`).
 *
 * They add nothing when reading a diff and eat up four rows of height. They
 * are filtered when painting, not when parsing: each line's `index` and `hunk`
 * remain those of the original patch, which is what line and hunk staging uses.
 */
export function stripPatchHeader(lines: ClassifiedPatchLine[]): ClassifiedPatchLine[] {
  const firstHunk = lines.findIndex((line) => line.type === "hunk");
  return firstHunk <= 0 ? lines : lines.slice(firstHunk);
}
