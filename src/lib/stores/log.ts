import { create } from "zustand";
import { formatGitError } from "../bridge/errors";
import {
  cherryPick as cherryPickRequest,
  cherryPickRange as cherryPickRangeRequest,
  resetTo as resetRequest,
  revertCommit as revertRequest,
  type ResetMode,
} from "../bridge/history";
import { listRefs, logPage } from "../bridge/log";
import type { Commit, LogSearch, RefEntry } from "../bridge/types";
import { emptyLayout, layoutPage, type GraphLayout } from "../graph/layout";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const PAGE_SIZE = 200;

/** Value of `selected` for the synthetic "Uncommitted changes" row. */
export const WORKTREE_SELECTION = "__worktree__";

type LogState = {
  root: string | null;
  commits: Commit[];
  layout: GraphLayout;
  refs: RefEntry[];
  filter: string | null;
  /** Active history search; `null` means the full log. */
  search: LogSearch | null;
  /** Path whose file history is shown; `null` = full history (OG-053). */
  historyPath: string | null;
  /** Up to two selected commits for comparison, in click order (OG-054). */
  compareSelection: string[];
  selected: string | null;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  /** Incremented when asking to locate a commit (sidebar): triggers the scroll. */
  revealRequest: number;
  load: (root: string) => Promise<void>;
  reload: (root: string) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (root: string, rev: string | null) => Promise<void>;
  /** Applies (or clears, if every field is empty) a history search. */
  applySearch: (root: string, search: LogSearch) => Promise<void>;
  clearSearch: (root: string) => Promise<void>;
  /** Opens the history filtered by one file, following renames (OG-053). */
  showFileHistory: (root: string, path: string) => Promise<void>;
  /** Leaves the file history and returns to the full log. */
  clearFileHistory: (root: string) => Promise<void>;
  /** Adds or removes a commit from the comparison selection (max. two). */
  toggleCompareSelection: (hash: string) => void;
  clearCompareSelection: () => void;
  select: (hash: string | null) => void;
  /** Loads pages until the commit is found, selects it and requests the scroll. */
  revealCommit: (root: string, hash: string) => Promise<void>;
  cherryPick: (root: string, hash: string) => Promise<void>;
  cherryPickRange: (root: string, revs: string[], recordSource: boolean) => Promise<void>;
  revert: (root: string, hash: string, mainline?: number) => Promise<void>;
  resetTo: (root: string, hash: string, mode: ResetMode) => Promise<void>;
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

/**
 * Graph input for a commit. In search mode the parents are dropped (OG-018):
 * they are not in the result and would leave lanes open that never close, so
 * the nodes are painted in a single column.
 */
function toInput(commit: Commit, parentless: boolean) {
  return {
    hash: commit.hash,
    parents: parentless ? [] : commit.parents,
    refs: commit.refs,
  };
}

/** Normalizes a search: trims the fields and returns `null` if all are empty. */
function activeSearch(search: LogSearch): LogSearch | null {
  const trimmed: LogSearch = {
    grep: search.grep.trim(),
    author: search.author.trim(),
    path: search.path.trim(),
  };
  if (trimmed.grep === "" && trimmed.author === "" && trimmed.path === "") {
    return null;
  }
  return trimmed;
}

/**
 * Search the active log should use: the file-history filter takes precedence
 * over the commit search, following the path across renames (OG-053).
 */
function currentSearch(state: Pick<LogState, "search" | "historyPath">): LogSearch | null {
  if (state.historyPath !== null) {
    return { grep: "", author: "", path: state.historyPath, follow: true };
  }
  return state.search;
}

export const useLogStore = create<LogState>((set, get) => ({
  root: null,
  commits: [],
  layout: emptyLayout(),
  refs: [],
  filter: null,
  search: null,
  historyPath: null,
  compareSelection: [],
  selected: null,
  revealRequest: 0,
  loading: false,
  hasMore: true,
  error: null,

  load: async (root) => {
    // Entering a project (new root) selects HEAD so the detail panel
    // shows something without having to click a row. When filtering or searching
    // within the same repository the selection is cleared, as before.
    const previous = get().root;
    const entering = previous !== root;
    // Switching from one open repository to another starts clean: keeping the
    // branch filter or the search of the previous one would load the new log
    // already filtered. The first load (no previous root) has nothing to reset.
    const switching = entering && previous !== null;
    set({
      root,
      loading: true,
      error: null,
      commits: [],
      layout: emptyLayout(),
      selected: null,
      hasMore: true,
      ...(switching ? { filter: null, search: null, historyPath: null, compareSelection: [] } : {}),
    });
    try {
      const { filter } = get();
      const search = currentSearch(get());
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, search),
      ]);
      // A different repository may have been opened while this was in flight.
      if (get().root !== root) return;
      const changes = useStatusStore.getState().report?.entries.length ?? 0;
      set({
        refs,
        commits,
        layout: layoutPage(commits.map((commit) => toInput(commit, search !== null))),
        hasMore: commits.length === PAGE_SIZE,
        // With pending changes the working tree row is preselected, so its
        // panels (files + patch) are visible as soon as the repo opens.
        selected: entering ? (changes > 0 ? WORKTREE_SELECTION : (commits[0]?.hash ?? null)) : null,
      });
    } catch (error) {
      if (get().root !== root) return;
      set({ error: formatGitError(error) });
    } finally {
      if (get().root === root) {
        set({ loading: false });
      }
    }
  },

  /// Silent refresh after the watcher: keeps selection, filter and search.
  reload: async (root) => {
    try {
      const { filter } = get();
      const search = currentSearch(get());
      const [refs, commits] = await Promise.all([
        listRefs(root),
        logPage(root, 0, PAGE_SIZE, filter, search),
      ]);
      const current = get().root;
      if (current !== null && current !== root) return;
      set({
        root,
        refs,
        commits,
        layout: layoutPage(commits.map((commit) => toInput(commit, search !== null))),
        hasMore: commits.length === PAGE_SIZE,
      });
    } catch (error) {
      const current = get().root;
      if (current !== null && current !== root) return;
      set({ error: formatGitError(error) });
    }
  },

  loadMore: async () => {
    const { root, loading, hasMore, commits, layout, filter } = get();
    if (!root || loading || !hasMore) return;
    set({ loading: true });
    const search = currentSearch(get());
    try {
      const page = await logPage(root, commits.length, PAGE_SIZE, filter, search);
      if (get().root !== root) return;
      set({
        commits: [...commits, ...page],
        layout: layoutPage(
          page.map((commit) => toInput(commit, search !== null)),
          layout,
        ),
        hasMore: page.length === PAGE_SIZE,
      });
    } catch (error) {
      if (get().root !== root) return;
      set({ error: formatGitError(error) });
    } finally {
      if (get().root === root) {
        set({ loading: false });
      }
    }
  },

  setFilter: async (root, rev) => {
    set({ filter: rev });
    await get().load(root);
  },

  applySearch: async (root, search) => {
    set({ search: activeSearch(search), historyPath: null });
    await get().load(root);
  },

  clearSearch: async (root) => {
    if (get().search === null) {
      return;
    }
    set({ search: null });
    await get().load(root);
  },

  showFileHistory: async (root, path) => {
    set({ historyPath: path, search: null });
    useUiStore.getState().setActiveView("history");
    await get().load(root);
  },

  clearFileHistory: async (root) => {
    if (get().historyPath === null) {
      return;
    }
    set({ historyPath: null });
    await get().load(root);
  },

  toggleCompareSelection: (hash) =>
    set((state) => {
      if (state.compareSelection.includes(hash)) {
        return { compareSelection: state.compareSelection.filter((item) => item !== hash) };
      }
      // Like SourceTree: Ctrl/Cmd+click keeps at most two, the oldest drops out.
      return { compareSelection: [...state.compareSelection, hash].slice(-2) };
    }),

  clearCompareSelection: () => set({ compareSelection: [] }),

  select: (hash) => set({ selected: hash }),

  revealCommit: async (root, hash) => {
    const found = () => get().commits.some((commit) => commit.hash === hash);
    // With an active branch filter, search or file history the commit may not
    // be in the log.
    if (
      (get().filter !== null || get().search !== null || get().historyPath !== null) &&
      !found()
    ) {
      set({ filter: null, search: null, historyPath: null });
      await get().load(root);
    }
    while (!found() && get().hasMore) {
      const before = get().commits.length;
      await get().loadMore();
      if (get().commits.length === before) {
        break;
      }
    }
    if (found()) {
      set((state) => ({ selected: hash, revealRequest: state.revealRequest + 1 }));
    }
  },

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

  cherryPickRange: async (root, revs, recordSource) => {
    try {
      const result = await cherryPickRangeRequest(root, revs, recordSource);
      if (result.conflicted) {
        output("Cherry-pick has conflicts; resolve them or abort");
      } else {
        output(result.output.trim() || `Cherry-picked ${revs.length} commit(s)`);
      }
      await refreshAfterRewrite(root, () => get().reload(root));
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Cherry-pick failed: ${message}`);
    }
  },

  revert: async (root, hash, mainline) => {
    try {
      await revertRequest(root, hash, mainline ?? null);
      output(`Reverted ${hash.slice(0, 7)}`);
      await refreshAfterRewrite(root, () => get().reload(root));
    } catch (error) {
      const message = formatGitError(error);
      set({ error: message });
      output(`Revert failed: ${message}`);
    }
  },

  resetTo: async (root, hash, mode) => {
    try {
      await resetRequest(root, hash, mode);
      output(`Reset to ${hash.slice(0, 7)} (${mode})`);
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
      search: null,
      historyPath: null,
      compareSelection: [],
      selected: null,
      revealRequest: 0,
      loading: false,
      hasMore: true,
      error: null,
    }),
}));
