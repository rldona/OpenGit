import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import { listRefs, logPage } from "../bridge/log";
import type { Commit, RefEntry } from "../bridge/types";
import { emptyLayout, layoutPage, type GraphLayout } from "../graph/layout";

const PAGE_SIZE = 200;

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
  loadMore: () => Promise<void>;
  setFilter: (root: string, rev: string | null) => Promise<void>;
  select: (hash: string | null) => void;
  reset: () => void;
};

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
      const filter = get().filter;
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter),
      ]);
      set({
        refs,
        commits,
        layout: layoutPage(commits.map(toInput)),
        hasMore: commits.length === PAGE_SIZE,
      });
    } catch (error) {
      set({ error: formatGitError(error) });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { root, loading, hasMore, commits, layout, filter } = get();
    if (!root || loading || !hasMore) return;
    set({ loading: true });
    try {
      const page = await logPage(root, commits.length, PAGE_SIZE, filter);
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
