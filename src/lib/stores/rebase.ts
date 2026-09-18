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
};

type RebaseState = {
  root: string | null;
  base: string | null;
  rows: PlanRow[];
  rewordMessage: string;
  loading: boolean;
  error: string | null;
  open: (root: string, base: string) => Promise<void>;
  setAction: (index: number, action: TodoAction) => void;
  move: (index: number, delta: number) => void;
  setRewordMessage: (message: string) => void;
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
  rewordMessage: "",
  loading: false,
  error: null,

  open: async (root, base) => {
    set({ root, base, loading: true, error: null, rows: [], rewordMessage: "" });
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
        })),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  setAction: (index, action) =>
    set((state) => ({
      rows: state.rows.map((row, position) => {
        if (position === index) {
          return { ...row, action };
        }
        // Solo se permite un reword por plan (v1).
        if (action === "reword" && row.action === "reword") {
          return { ...row, action: "pick" };
        }
        return row;
      }),
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

  setRewordMessage: (rewordMessage) => set({ rewordMessage }),

  run: async (root) => {
    const { base, rows, rewordMessage } = get();
    if (!base || rows.length === 0) {
      return false;
    }
    const hasReword = rows.some((row) => row.action === "reword");
    if (hasReword && rewordMessage.trim() === "") {
      set({ error: "Write the new message for the reworded commit" });
      return false;
    }
    set({ loading: true, error: null });
    try {
      await interactiveRebase(
        root,
        base,
        rows.map((row) => ({ hash: row.hash, action: row.action })),
        hasReword ? rewordMessage : null,
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
      rewordMessage: "",
      loading: false,
      error: null,
    }),
}));
