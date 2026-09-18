import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { interactiveRebase, rebasePlan } from "../bridge/rebase";
import type { TodoAction } from "../bridge/types";
import { useCommitStore } from "./commit";
import { useLogStore } from "./log";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

export type PlanRow = {
  hash: string;
  short: string;
  subject: string;
  action: TodoAction;
  message: string;
};

type RebaseState = {
  root: string | null;
  base: string | null;
  rows: PlanRow[];
  loading: boolean;
  error: string | null;
  open: (root: string, base: string) => Promise<void>;
  setAction: (index: number, action: TodoAction) => void;
  move: (index: number, delta: number) => void;
  setMessage: (index: number, message: string) => void;
  run: (root: string) => Promise<boolean>;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useRebaseStore = create<RebaseState>((set, get) => ({
  root: null,
  base: null,
  rows: [],
  loading: false,
  error: null,

  open: async (root, base) => {
    set({ root, base, loading: true, error: null, rows: [] });
    try {
      const plan = await rebasePlan(root, base);
      if (plan.length === 0) {
        set({ loading: false, error: "Nothing to rebase from this commit" });
        return;
      }
      set({
        rows: plan.map((commit) => ({
          hash: commit.hash,
          short: commit.short,
          subject: commit.subject,
          action: "pick",
          message: "",
        })),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  setAction: (index, action) =>
    set((state) => ({
      rows: state.rows.map((row, position) => (position === index ? { ...row, action } : row)),
    })),

  move: (index, delta) =>
    set((state) => {
      const target = index + delta;
      if (target < 0 || target >= state.rows.length) {
        return state;
      }
      const rows = [...state.rows];
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { rows };
    }),

  setMessage: (index, message) =>
    set((state) => ({
      rows: state.rows.map((row, position) => (position === index ? { ...row, message } : row)),
    })),

  run: async (root) => {
    const { base, rows } = get();
    if (!base || rows.length === 0) {
      return false;
    }
    const missing = rows.some((row) => row.action === "reword" && row.message.trim() === "");
    if (missing) {
      set({ error: "Write the new message for every reworded commit" });
      return false;
    }
    set({ loading: true, error: null });
    try {
      await interactiveRebase(
        root,
        base,
        rows.map((row) => ({
          hash: row.hash,
          action: row.action,
          message: row.action === "reword" ? row.message : null,
        })),
      );
      output(`Interactive rebase of ${rows.length} commit(s) done`);
      set({ loading: false });
      await useStatusStore.getState().refresh(root);
      await useLogStore.getState().reload(root);
      const refsRoot = useRefsStore.getState().root;
      if (refsRoot) {
        await useRefsStore.getState().refresh(refsRoot);
      }
      await useCommitStore.getState().load(root);
      return true;
    } catch (error) {
      const message = formatGitError(error);
      set({ loading: false, error: message });
      output(`Interactive rebase failed: ${message}`);
      await useCommitStore.getState().load(root);
      return false;
    }
  },

  reset: () =>
    set({
      root: null,
      base: null,
      rows: [],
      loading: false,
      error: null,
    }),
}));
