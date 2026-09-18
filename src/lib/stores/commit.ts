import { create } from "zustand";
import { commitMessage, commitRepo, repoOpState } from "../bridge/commit";
import { confirmDestructive } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import type { RepoOpState } from "../bridge/types";
import { useLogStore } from "./log";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const EMPTY_OP_STATE: RepoOpState = { merge: false, rebase: false, cherry_pick: false };

type CommitState = {
  root: string | null;
  message: string;
  amend: boolean;
  opState: RepoOpState;
  loading: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  setMessage: (message: string) => void;
  setAmend: (amend: boolean) => Promise<void>;
  submit: (stagedCount: number) => Promise<boolean>;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useCommitStore = create<CommitState>((set, get) => ({
  root: null,
  message: "",
  amend: false,
  opState: EMPTY_OP_STATE,
  loading: false,
  error: null,

  load: async (root) => {
    set({ root, error: null });
    try {
      set({ opState: await repoOpState(root) });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  setMessage: (message) => set({ message }),

  /// El amend reescribe historia local: se confirma y se precarga el mensaje.
  setAmend: async (amend) => {
    if (!amend) {
      set({ amend: false, message: "" });
      return;
    }
    const root = get().root;
    if (!root) {
      set({ amend: true });
      return;
    }
    const confirmed = await confirmDestructive(
      "Amend rewrites the last commit. Do you want to continue?",
    );
    if (!confirmed) {
      set({ amend: false });
      return;
    }
    try {
      set({ amend: true, message: await commitMessage(root) });
    } catch (error) {
      set({ amend: false, error: formatGitError(error) });
    }
  },

  submit: async (stagedCount) => {
    const { root, message, amend } = get();
    if (!root) {
      return false;
    }
    if (message.trim() === "") {
      set({ error: "Write a commit message" });
      return false;
    }
    if (stagedCount === 0 && !amend) {
      set({ error: "Nothing staged: stage changes before committing" });
      return false;
    }
    set({ loading: true, error: null });
    try {
      const result = await commitRepo(root, message, amend);
      output(`Commit ${result.hash}: ${result.subject}`);
      set({ message: "", amend: false, loading: false });
      await useStatusStore.getState().refresh(root);
      await useLogStore.getState().reload(root);
      return true;
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
      return false;
    }
  },

  reset: () =>
    set({
      root: null,
      message: "",
      amend: false,
      opState: EMPTY_OP_STATE,
      loading: false,
      error: null,
    }),
}));
