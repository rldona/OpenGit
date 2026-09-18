import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import {
  cherryPick as cherryPickRequest,
  resetMixed,
  revertCommit as revertRequest,
} from "../bridge/history";
import { listRefs, logPage } from "../bridge/log";
import type { Commit, LogSearch, RefEntry } from "../bridge/types";
import { emptyLayout, layoutPage, type GraphLayout } from "../graph/layout";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const PAGE_SIZE = 200;

export const EMPTY_SEARCH: LogSearch = { grep: "", author: "", path: "" };

function hasSearch(search: LogSearch): boolean {
  return [search.grep, search.author, search.path].some((value) => value.trim() !== "");
}

function searchRequest(search: LogSearch): LogSearch | null {
  return hasSearch(search) ? search : null;
}

type LogState = {
  root: string | null;
  commits: Commit[];
  layout: GraphLayout;
  refs: RefEntry[];
  filter: string | null;
  search: LogSearch;
  selected: string | null;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  load: (root: string) => Promise<void>;
  reload: (root: string) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (root: string, rev: string | null) => Promise<void>;
  applySearch: (root: string, search: LogSearch) => Promise<void>;
  clearSearch: (root: string) => Promise<void>;
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

function toInput(commit: Commit, flat: boolean) {
  return { hash: commit.hash, parents: flat ? [] : commit.parents, refs: commit.refs };
}

export const useLogStore = create<LogState>((set, get) => ({
  root: null,
  commits: [],
  layout: emptyLayout(),
  refs: [],
  filter: null,
  search: { ...EMPTY_SEARCH },
  selected: null,
  loading: false,
  hasMore: true,
  error: null,

  load: async (root) => {
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
      const { filter, search } = get();
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, searchRequest(search)),
      ]);
      const flat = hasSearch(search);
      set({
        refs,
        commits,
        layout: layoutPage(commits.map((commit) => toInput(commit, flat))),
        hasMore: commits.length === PAGE_SIZE,
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
      const { filter, search } = get();
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, searchRequest(search)),
      ]);
      const flat = hasSearch(search);
      set({
        root,
        refs,
        commits,
        layout: layoutPage(commits.map((commit) => toInput(commit, flat))),
        hasMore: commits.length === PAGE_SIZE,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  loadMore: async () => {
    const { root, loading, hasMore, commits, layout, filter, search } = get();
    if (!root || loading || !hasMore) return;
    set({ loading: true });
    try {
      const page = await logPage(root, commits.length, PAGE_SIZE, filter, searchRequest(search));
      set({
        commits: [...commits, ...page],
        layout: layoutPage(
          page.map((commit) => toInput(commit, hasSearch(search))),
          layout,
        ),
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

  applySearch: async (root, search) => {
    set({ search });
    await get().load(root);
  },

  clearSearch: async (root) => {
    set({ search: { ...EMPTY_SEARCH } });
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
      search: { ...EMPTY_SEARCH },
      selected: null,
      loading: false,
      hasMore: true,
      error: null,
    }),
}));
