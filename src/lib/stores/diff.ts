import { create } from "zustand";
import {
  commitFiles,
  diffFile,
  diffNumstat,
  discardSelection,
  stageSelection,
  type HunkSelection,
} from "../bridge/diff";
import { formatGitError } from "../bridge/errors";
import { statusRepo } from "../bridge/status";
import type { FileDiff } from "../bridge/types";
import { isBinaryPatch } from "../diff/patch";
import { useStatusStore } from "./status";

export type DiffTarget = { kind: "worktree" } | { kind: "commit"; rev: string };
export type DiffMode = "unified" | "side";

export type DiffFileEntry = {
  key: string;
  path: string;
  orig_path: string | null;
  added: number | null;
  deleted: number | null;
  binary: boolean;
  untracked: boolean;
  staged: boolean;
};

type DiffState = {
  root: string | null;
  target: DiffTarget | null;
  files: DiffFileEntry[];
  selected: DiffFileEntry | null;
  patch: string;
  binary: boolean;
  mode: DiffMode;
  reversed: boolean;
  selectedLines: number[];
  loading: boolean;
  error: string | null;
  openWorktree: (root: string) => Promise<void>;
  openWorktreeFile: (root: string, file: string, staged?: boolean) => Promise<void>;
  openCommit: (root: string, rev: string) => Promise<void>;
  selectFile: (entry: DiffFileEntry) => Promise<void>;
  setMode: (mode: DiffMode) => void;
  toggleReverse: () => Promise<void>;
  toggleLine: (index: number) => void;
  clearSelection: () => void;
  applySelection: (selection: HunkSelection) => Promise<void>;
  discardSelection: (selection: HunkSelection) => Promise<void>;
  reset: () => void;
};

function indexByPath(diffs: FileDiff[]): Map<string, FileDiff> {
  const map = new Map<string, FileDiff>();
  for (const diff of diffs) {
    map.set(diff.path, diff);
    if (diff.orig_path) {
      map.set(diff.orig_path, diff);
    }
  }
  return map;
}

export const useDiffStore = create<DiffState>((set, get) => ({
  root: null,
  target: null,
  files: [],
  selected: null,
  patch: "",
  binary: false,
  mode: "side",
  reversed: false,
  selectedLines: [],
  loading: false,
  error: null,

  openWorktree: async (root) => {
    set({ root, target: { kind: "worktree" }, loading: true, error: null, reversed: false });
    try {
      const [report, unstaged, staged] = await Promise.all([
        statusRepo(root),
        diffNumstat(root, false),
        diffNumstat(root, true),
      ]);
      const stagedMap = indexByPath(staged);
      const unstagedMap = indexByPath(unstaged);
      const files: DiffFileEntry[] = [];
      for (const entry of report.entries) {
        if (entry.kind === "untracked") {
          files.push({
            key: `worktree:${entry.path}`,
            path: entry.path,
            orig_path: null,
            added: null,
            deleted: null,
            binary: false,
            untracked: true,
            staged: false,
          });
          continue;
        }
        for (const stagedSide of [true, false] as const) {
          const present = stagedSide ? entry.xy[0] !== "." : entry.xy[1] !== ".";
          if (!present) continue;
          const counts = (stagedSide ? stagedMap : unstagedMap).get(entry.path);
          files.push({
            key: `${stagedSide ? "index" : "worktree"}:${entry.path}`,
            path: entry.path,
            orig_path: entry.orig_path,
            added: counts?.added ?? null,
            deleted: counts?.deleted ?? null,
            binary: counts?.binary ?? false,
            untracked: false,
            staged: stagedSide,
          });
        }
      }
      files.sort((a, b) => a.path.localeCompare(b.path));
      set({ files, selected: null, patch: "", binary: false, loading: false });
      if (files.length > 0) {
        await get().selectFile(files[0]);
      }
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  openWorktreeFile: async (root, file, staged) => {
    await get().openWorktree(root);
    const files = get().files;
    const entry =
      files.find(
        (item) => item.path === file && (staged === undefined || item.staged === staged),
      ) ?? files.find((item) => item.path === file);
    if (entry) {
      await get().selectFile(entry);
    }
  },

  openCommit: async (root, rev) => {
    set({
      root,
      target: { kind: "commit", rev },
      files: [],
      selected: null,
      patch: "",
      binary: false,
      loading: true,
      error: null,
      reversed: false,
    });
    try {
      const diffs = await commitFiles(root, rev);
      const files: DiffFileEntry[] = diffs.map((diff) => ({
        key: `commit:${diff.path}`,
        path: diff.path,
        orig_path: diff.orig_path,
        added: diff.added,
        deleted: diff.deleted,
        binary: diff.binary,
        untracked: false,
        staged: false,
      }));
      set({ files, loading: false });
      if (files.length > 0) {
        await get().selectFile(files[0]);
      }
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  selectFile: async (entry) => {
    const { root, target, reversed } = get();
    if (!root || !target) return;
    set({ selectedLines: [] });
    if (entry.untracked) {
      set({ selected: entry, patch: "", binary: false });
      return;
    }
    set({ selected: entry, loading: true, error: null });
    try {
      const patch = await diffFile({
        path: root,
        file: entry.path,
        staged: target.kind === "worktree" && entry.staged,
        rev: target.kind === "commit" ? target.rev : null,
        reversed,
      });
      set({ patch, binary: entry.binary || isBinaryPatch(patch), loading: false });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  setMode: (mode) => set({ mode }),

  toggleReverse: async () => {
    set({ reversed: !get().reversed });
    const selected = get().selected;
    if (selected && !selected.untracked) {
      await get().selectFile(selected);
    }
  },

  toggleLine: (index) =>
    set((state) => ({
      selectedLines: state.selectedLines.includes(index)
        ? state.selectedLines.filter((line) => line !== index)
        : [...state.selectedLines, index],
    })),

  clearSelection: () => set({ selectedLines: [] }),

  /// Aplica stage o unstage de la selección; solo en working tree/index.
  applySelection: async (selection) => {
    const { root, target, selected } = get();
    if (!root || !target || !selected || target.kind !== "worktree" || selected.untracked) {
      return;
    }
    set({ loading: true, error: null });
    try {
      await stageSelection({
        path: root,
        file: selected.path,
        staged: selected.staged,
        selection,
        reverse: selected.staged,
      });
      set({ selectedLines: [] });
      await get().selectFile(selected);
      await useStatusStore.getState().refresh(root);
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  /// Destructivo: descarta la selección del lado unstaged del working tree.
  discardSelection: async (selection) => {
    const { root, target, selected } = get();
    if (
      !root ||
      !target ||
      target.kind !== "worktree" ||
      !selected ||
      selected.untracked ||
      selected.staged
    ) {
      return;
    }
    set({ loading: true, error: null });
    try {
      await discardSelection({ path: root, file: selected.path, selection });
      set({ selectedLines: [] });
      await get().selectFile(selected);
      await useStatusStore.getState().refresh(root);
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  reset: () =>
    set({
      root: null,
      target: null,
      files: [],
      selected: null,
      patch: "",
      binary: false,
      mode: "side",
      reversed: false,
      selectedLines: [],
      loading: false,
      error: null,
    }),
}));
