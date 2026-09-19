/**
 * Parsing of conflict markers in the working tree file. Pure functions:
 * they respect the user's `merge.conflictStyle` (including `diff3` with base).
 */

export type ConflictChoice = "ours" | "theirs" | "both";

export type ConflictBlock =
  | { kind: "common"; lines: string[] }
  | {
      kind: "conflict";
      ours: string[];
      base: string[] | null;
      theirs: string[];
      oursLabel: string;
      theirsLabel: string;
    };

const OURS_MARKER = "<<<<<<<";
const BASE_MARKER = "|||||||";
const SEPARATOR = "=======";
const THEIRS_MARKER = ">>>>>>>";

export function parseConflictBlocks(content: string): ConflictBlock[] {
  const lines = content.split("\n");
  const blocks: ConflictBlock[] = [];
  let common: string[] = [];
  let index = 0;

  const flushCommon = () => {
    if (common.length > 0) {
      blocks.push({ kind: "common", lines: common });
      common = [];
    }
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith(OURS_MARKER)) {
      common.push(line);
      index += 1;
      continue;
    }

    flushCommon();
    const oursLabel = line.slice(OURS_MARKER.length).trim();
    index += 1;

    const ours: string[] = [];
    while (
      index < lines.length &&
      !lines[index].startsWith(SEPARATOR) &&
      !lines[index].startsWith(BASE_MARKER)
    ) {
      ours.push(lines[index]);
      index += 1;
    }

    let base: string[] | null = null;
    if (index < lines.length && lines[index].startsWith(BASE_MARKER)) {
      base = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith(SEPARATOR)) {
        base.push(lines[index]);
        index += 1;
      }
    }

    if (index < lines.length && lines[index].startsWith(SEPARATOR)) {
      index += 1;
    }

    const theirs: string[] = [];
    while (index < lines.length && !lines[index].startsWith(THEIRS_MARKER)) {
      theirs.push(lines[index]);
      index += 1;
    }

    let theirsLabel = "";
    if (index < lines.length) {
      theirsLabel = lines[index].slice(THEIRS_MARKER.length).trim();
      index += 1;
    }

    blocks.push({ kind: "conflict", ours, base, theirs, oursLabel, theirsLabel });
  }

  flushCommon();
  return blocks;
}

export function conflictCount(blocks: ConflictBlock[]): number {
  return blocks.filter((block) => block.kind === "conflict").length;
}

/** Rebuilds the content by choosing one side per block. */
export function resolvedContent(
  blocks: ConflictBlock[],
  choices: Record<number, ConflictChoice>,
): { content: string; unresolved: number } {
  const parts: string[] = [];
  let unresolved = 0;
  let conflictIndex = -1;

  for (const block of blocks) {
    if (block.kind === "common") {
      parts.push(...block.lines);
      continue;
    }
    conflictIndex += 1;
    const choice = choices[conflictIndex];
    if (choice === "ours") {
      parts.push(...block.ours);
    } else if (choice === "theirs") {
      parts.push(...block.theirs);
    } else if (choice === "both") {
      parts.push(...block.ours, ...block.theirs);
    } else {
      unresolved += 1;
    }
  }

  return { content: parts.join("\n"), unresolved };
}
