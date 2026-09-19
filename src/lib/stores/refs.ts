import { create } from "zustand";
import { confirmDestructive } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import { listRefs } from "../bridge/log";
import {
  branchTracking,
  checkoutRef,
  createBranch,
  deleteBranch,
  mergeBranch,
  renameBranch,
  trackingCommits,
} from "../bridge/refs";
import { tagCreate, tagDelete } from "../bridge/tags";
import type { MergeResult, RefEntry, TrackingCommits } from "../bridge/types";
import { useLogStore } from "./log";
import { useStatusStore } from "./status";

/** Sets de incoming/outgoing; sin upstream no hay llamada a git. */
async function loadTrackingCommits(
  root: string,
  upstream: string | null,
): Promise<{ incoming: string[]; outgoing: string[] }> {
  if (!upstream) {
    return { incoming: [], outgoing: [] };
  }
  try {
    const commits: TrackingCommits = await trackingCommits(root, upstream);
    return { incoming: commits.incoming, outgoing: commits.outgoing };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}
import { useUiStore } from "./ui";

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

function shortName(fullName: string): string {
  return fullName.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "");
}

type RefsState = {
  root: string | null;
  refs: RefEntry[];
  current: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  incoming: string[];
  outgoing: string[];
  loading: boolean;
  error: string | null;
  pendingForceDelete: string | null;
  load: (root: string) => Promise<void>;
  refresh: (root: string) => Promise<void>;
  checkout: (root: string, ref: RefEntry) => Promise<void>;
  /** Fusiona `rev` en la rama actual; `null` si git falló. */
  merge: (root: string, rev: string, noFf: boolean) => Promise<MergeResult | null>;
  create: (root: string, name: string, startPoint: string) => Promise<boolean>;
  rename: (root: string, oldName: string, newName: string) => Promise<boolean>;
  remove: (root: string, name: string) => Promise<void>;
  forceRemove: (root: string, name: string, typed: string) => Promise<void>;
  cancelForceDelete: () => void;
  createTag: (
    root: string,
    name: string,
    target: string,
    message: string | null,
  ) => Promise<boolean>;
  deleteTag: (root: string, name: string) => Promise<void>;
  reset: () => void;
};

export const useRefsStore = create<RefsState>((set, get) => ({
  root: null,
  refs: [],
  current: null,
  upstream: null,
  ahead: 0,
  behind: 0,
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,
  pendingForceDelete: null,

  load: async (root) => {
    set({ root, loading: true, error: null });
    try {
      const [refs, tracking] = await Promise.all([listRefs(root), branchTracking(root)]);
      const commits = await loadTrackingCommits(root, tracking.upstream);
      set({
        refs,
        current: tracking.current,
        upstream: tracking.upstream,
        ahead: tracking.ahead,
        behind: tracking.behind,
        ...commits,
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: formatGitError(error) });
    }
  },

  refresh: async (root) => {
    try {
      const [refs, tracking] = await Promise.all([listRefs(root), branchTracking(root)]);
      const commits = await loadTrackingCommits(root, tracking.upstream);
      set({
        root,
        refs,
        current: tracking.current,
        upstream: tracking.upstream,
        ahead: tracking.ahead,
        behind: tracking.behind,
        ...commits,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  checkout: async (root, ref) => {
    const isRemote = ref.name.startsWith("refs/remotes/");
    const target = isRemote ? ref.name.replace(/^refs\/remotes\//, "") : shortName(ref.name);
    const localName = isRemote ? target.split("/").slice(1).join("/") : target;
    const track = isRemote && !get().refs.some((item) => item.name === `refs/heads/${localName}`);

    const changes = useStatusStore.getState().report?.entries.length ?? 0;
    if (changes > 0) {
      const confirmed = await confirmDestructive(
        `The working tree has ${changes} uncommitted change(s). Checkout may fail or keep them. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    set({ error: null });
    try {
      await checkoutRef(root, target, track);
      output(`Checked out ${target}`);
      await get().refresh(root);
      await useStatusStore.getState().refresh(root);
      await useLogStore.getState().reload(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  merge: async (root, rev, noFf) => {
    set({ error: null });
    try {
      const result = await mergeBranch(root, rev, noFf);
      for (const line of result.output.split("\n")) {
        if (line.trim() !== "") {
          output(line);
        }
      }
      output(result.conflicted ? `Merge conflicts from ${rev}` : `Merged ${rev}`);
      await get().refresh(root);
      await useStatusStore.getState().refresh(root);
      await useLogStore.getState().reload(root);
      return result;
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Merge failed: ${message}`);
      return null;
    }
  },

  create: async (root, name, startPoint) => {
    set({ error: null });
    try {
      await createBranch(root, name, startPoint);
      output(`Created branch ${name}`);
      await get().refresh(root);
      return true;
    } catch (error) {
      set({ error: formatGitError(error) });
      return false;
    }
  },

  rename: async (root, oldName, newName) => {
    set({ error: null });
    try {
      await renameBranch(root, oldName, newName);
      output(`Renamed ${oldName} to ${newName}`);
      await get().refresh(root);
      return true;
    } catch (error) {
      set({ error: formatGitError(error) });
      return false;
    }
  },

  remove: async (root, name) => {
    set({ error: null, pendingForceDelete: null });
    try {
      await deleteBranch(root, name, false);
      output(`Deleted branch ${name}`);
      await get().refresh(root);
    } catch (error) {
      const message = formatGitError(error);
      if (message.includes("not fully merged")) {
        set({
          pendingForceDelete: name,
          error: `Branch ${name} is not fully merged. Type its name to force delete.`,
        });
      } else {
        set({ error: message });
      }
    }
  },

  forceRemove: async (root, name, typed) => {
    if (typed !== name) {
      set({ error: "Type the branch name exactly to confirm" });
      return;
    }
    set({ error: null });
    try {
      await deleteBranch(root, name, true);
      output(`Force deleted branch ${name}`);
      set({ pendingForceDelete: null });
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  cancelForceDelete: () => set({ pendingForceDelete: null, error: null }),

  createTag: async (root, name, target, message) => {
    set({ error: null });
    try {
      await tagCreate(root, name, target, message);
      output(`Created tag ${name}`);
      await get().refresh(root);
      return true;
    } catch (error) {
      set({ error: formatGitError(error) });
      return false;
    }
  },

  deleteTag: async (root, name) => {
    set({ error: null });
    try {
      await tagDelete(root, name);
      output(`Deleted tag ${name}`);
      await get().refresh(root);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  reset: () =>
    set({
      root: null,
      refs: [],
      current: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      incoming: [],
      outgoing: [],
      loading: false,
      error: null,
      pendingForceDelete: null,
    }),
}));
