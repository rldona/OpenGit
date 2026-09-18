import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import {
  cherryPick as cherryPickRequest,
  resetMixed,
  revertCommit as revertRequest,
} from "../bridge/history";
import { listRefs, logPage } from "../bridge/log";
import type { Commit, RefEntry } from "../bridge/types";
import { emptyLayout, layoutPage, type GraphLayout } from "../graph/layout";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const PAGE_SIZE = 200;

/** Valor de `selected` para la fila sintética "Uncommitted changes". */
export const WORKTREE_SELECTION = "__worktree__";

type LogState = {
  root: string | null;
  commits: Commit[];
  layout: GraphLayout;
  refs: RefEntry[];
  filter: string | null;
  selected: string | null;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  reload: (root: string) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (root: string, rev: string | null) => Promise<void>;
  select: (hash: string | null) => void;
  cherryPick: (root: string, hash: string) => Promise<void>;
  revert: (root: string, hash: string) => Promise<void>;
  resetTo: (root: string, hash: string) => Promise<void>;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

async function refreshAfterRewrite(root: string, reload: () => Promise<void>): Promise<void> {
  await reload();
  const refsRoot = useRefsStore.getState().root;
  if (refsRoot) {
    await useRefsStore.getState().refresh(refsRoot);
  }
  await useStatusStore.getState().refresh(root);
}

function toInput(commit: Commit) {
  return { hash: commit.hash, parents: commit.parents, refs: commit.refs };
}

export const useLogStore = create<LogState>((set, get) => ({
  root: null,
  commits: [],
  layout: emptyLayout(),
  refs: [],
  filter: null,
  selected: null,
  loading: false,
  hasMore: true,
  error: null,

  load: async (root) => {
    // Entrar en un proyecto (root nuevo) selecciona HEAD para que el panel de
    // detalle muestre algo sin tener que pulsar una fila. Al filtrar o buscar
    // dentro del mismo repositorio la selección se limpia, como antes.
    const entering = get().root !== root;
    set({
      root,
      loading: true,
      error: null,
      commits: [],
      layout: emptyLayout(),
      selected: null,
      hasMore: true,
    });
    try {
      const { filter } = get();
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, null),
      ]);
      set({
        refs,
        commits,
        layout: layoutPage(commits.map(toInput)),
        hasMore: commits.length === PAGE_SIZE,
        selected: entering ? (commits[0]?.hash ?? null) : null,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    } finally {
      set({ loading: false });
    }
  },

  /// Refresco silencioso tras el watcher: conserva selección y filtro.
  reload: async (root) => {
    try {
      const { filter } = get();
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, null),
      ]);
      set({
        root,
        refs,
        commits,
        layout: layoutPage(commits.map(toInput)),
        hasMore: commits.length === PAGE_SIZE,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  loadMore: async () => {
    const { root, loading, hasMore, commits, layout, filter } = get();
    if (!root || loading || !hasMore) return;
    set({ loading: true });
    try {
      const page = await logPage(root, commits.length, PAGE_SIZE, filter, null);
      set({
        commits: [...commits, ...page],
        layout: layoutPage(page.map(toInput), layout),
        hasMore: page.length === PAGE_SIZE,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    } finally {
      set({ loading: false });
    }
  },

  setFilter: async (root, rev) => {
    set({ filter: rev });
    await get().load(root);
  },

  select: (hash) => set({ selected: hash }),

  cherryPick: async (root, hash) => {
    try {
      await cherryPickRequest(root, hash);
      output(`Cherry-picked ${hash.slice(0, 7)}`);
      await refreshAfterRewrite(root, () => get().reload(root));
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Cherry-pick failed: ${message}`);
    }
  },

  revert: async (root, hash) => {
    try {
      await revertRequest(root, hash);
      output(`Reverted ${hash.slice(0, 7)}`);
      await refreshAfterRewrite(root, () => get().reload(root));
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Revert failed: ${message}`);
    }
  },

  resetTo: async (root, hash) => {
    try {
      await resetMixed(root, hash);
      output(`Reset to ${hash.slice(0, 7)} (mixed)`);
      await refreshAfterRewrite(root, () => get().reload(root));
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Reset failed: ${message}`);
    }
  },

  reset: () =>
    set({
      root: null,
      commits: [],
      layout: emptyLayout(),
      refs: [],
      filter: null,
      selected: null,
      loading: false,
      hasMore: true,
      error: null,
    }),
}));
