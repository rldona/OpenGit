import { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { ApplyPatchDialog } from "./components/ApplyPatchDialog";
import { BisectBanner } from "./components/BisectBanner";
import { BisectStartDialog } from "./components/BisectStartDialog";
import { BlameView } from "./components/BlameView";
import { CloneDialog } from "./components/CloneDialog";
import { ConflictView } from "./components/ConflictView";
import { CreateDialog } from "./components/CreateDialog";
import { DiffView } from "./components/DiffView";
import { ExtrasSidebar } from "./components/ExtrasSidebar";
import { FetchDialog } from "./components/FetchDialog";
import { HistoryView } from "./components/HistoryView";
import { MergeWindow } from "./components/MergeWindow";
import { OpBanner } from "./components/OpBanner";
import { PullDialog } from "./components/PullDialog";
import { RecentProjects } from "./components/RecentProjects";
import { RebaseView } from "./components/RebaseView";
import { ReflogView } from "./components/ReflogView";
import { SearchView } from "./components/SearchView";
import { RemoteJobModal } from "./components/RemoteJobModal";
import { RepoTabs } from "./components/RepoTabs";
import { SettingsWindow } from "./components/SettingsWindow";
import { RefsSidebar } from "./components/RefsSidebar";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { SplitPane } from "./components/SplitPane";
import { StashSidebar } from "./components/StashSidebar";
import { StashView } from "./components/StashView";
import { StatusView } from "./components/StatusView";
import { Toolbar } from "./components/Toolbar";
import { UpdateDialog } from "./components/UpdateDialog";
import { initialRepo } from "./lib/bridge/app";
import { confirmDestructive } from "./lib/bridge/dialog";
import { subscribeMenuEvents } from "./lib/bridge/events";
import { setMenuLocale } from "./lib/bridge/menu";
import { openExternal } from "./lib/bridge/opener";
import { setWindowTitle } from "./lib/bridge/window";
import { useJobEvents } from "./lib/hooks/useJobEvents";
import { useRepoEvents } from "./lib/hooks/useRepoEvents";
import { useShortcuts, type ShortcutHandlers } from "./lib/hooks/useShortcuts";
import { t as msg, useI18n } from "./lib/i18n";
import { LAYOUT_KEYS } from "./lib/layout";
import { refreshRepo } from "./lib/refresh";
import { loadStoredSession } from "./lib/tabs";
import { hasActiveOperation, stagedEntries, useCommitStore } from "./lib/stores/commit";
import { useLogStore } from "./lib/stores/log";
import { useRefsStore } from "./lib/stores/refs";
import { useRemoteStore } from "./lib/stores/remote";
import { useRepoStore } from "./lib/stores/repo";
import { syncAutoRefresh, useSettingsStore } from "./lib/stores/settings";
import { useStatusStore } from "./lib/stores/status";
import { useThemeStore } from "./lib/stores/theme";
import { useUiStore } from "./lib/stores/ui";
import { useUpdateStore } from "./lib/stores/update";

const PROJECT_URL = "https://github.com/rldona/OpenGit";

/** Whether a stored session should be reopened on this launch (OG-082/OG-084). */
function shouldRestoreSession(): boolean {
  return useSettingsStore.getState().restoreTabs && (loadStoredSession()?.paths.length ?? 0) > 0;
}

function App() {
  const { t, locale } = useI18n();
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
  const outputLines = useUiStore((state) => state.outputLines);
  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const toggleShortcuts = useUiStore((state) => state.toggleShortcuts);

  const theme = useThemeStore((state) => state.resolved);
  const setSystemDark = useThemeStore((state) => state.setSystemDark);

  const repo = useRepoStore((state) => state.repo);
  const loading = useRepoStore((state) => state.loading);
  const error = useRepoStore((state) => state.error);
  const loadRecents = useRepoStore((state) => state.loadRecents);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);

  const startRemote = useRemoteStore((state) => state.start);
  const currentBranch = useRefsStore((state) => state.current);
  const currentUpstream = useRefsStore((state) => state.upstream);
  const conflictCount = useStatusStore(
    (state) => state.report?.entries.filter((entry) => entry.kind === "unmerged").length ?? 0,
  );

  useRepoEvents(repo?.root ?? null);
  useJobEvents();

  const [pullOpen, setPullOpen] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyPatchOpen, setApplyPatchOpen] = useState(false);
  const [bisectOpen, setBisectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const runFetch = () => {
    if (repo) {
      setFetchOpen(true);
    }
  };

  const runPull = () => {
    if (repo) {
      setPullOpen(true);
    }
  };

  const runMerge = () => {
    if (repo) {
      setMergeOpen(true);
    }
  };

  const runPush = async () => {
    if (!repo) {
      return;
    }
    if (
      (currentBranch === "main" || currentBranch === "master") &&
      !(await confirmDestructive(msg("app.pushConfirm", { branch: currentBranch })))
    ) {
      return;
    }
    await startRemote(repo.root, {
      kind: "push",
      remote: null,
      set_upstream: currentUpstream === null,
    });
  };

  useEffect(() => {
    void loadRecents();
  }, [loadRecents]);

  // While a stored session is reopening, the home is suppressed so it does not
  // flash before the tabs (OG-084).
  const [restoringSession, setRestoringSession] = useState(shouldRestoreSession);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // A new window opens the repository it was created for (ADR-0008).
      const initial = await initialRepo().catch(() => null);
      if (cancelled) {
        return;
      }
      if (initial !== null) {
        await useRepoStore.getState().open(initial);
        if (!cancelled) {
          setRestoringSession(false);
        }
        return;
      }
      // Otherwise reopen the previous session when the preference is on (OG-082).
      const session = shouldRestoreSession() ? loadStoredSession() : null;
      if (session !== null) {
        await useRepoStore.getState().restoreSession(session.paths, session.active);
      }
      if (!cancelled) {
        setRestoringSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Silent update check on startup (OG-081): only surfaces a ready update;
    // the store skips it when the 24h cache is fresh.
    void useUpdateStore.getState().check();
  }, []);

  useEffect(() => {
    // The stored "Automatically refresh" preference has to reach the watcher.
    syncAutoRefresh();
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) {
      return;
    }
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setSystemDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // The native menu is built in Rust; it follows the active UI locale (OG-106).
    void setMenuLocale(locale).catch(() => {
      // Without a native menu (or outside Tauri) the UI keeps working.
    });
  }, [locale]);

  const refreshAll = async () => {
    const opened = useRepoStore.getState().repo;
    if (!opened) {
      return;
    }
    setRefreshing(true);
    try {
      await refreshRepo(opened.root);
      useUiStore.getState().appendOutput(msg("app.refreshed", { name: opened.name }));
    } finally {
      setRefreshing(false);
    }
  };

  const commitStaged = () => {
    if (!useRepoStore.getState().repo) {
      return;
    }
    const { loading, opState, submit } = useCommitStore.getState();
    if (loading || hasActiveOperation(opState)) {
      return;
    }
    void submit(stagedEntries(useStatusStore.getState().report).length);
  };

  const closeOverlayOrSelection = () => {
    const ui = useUiStore.getState();
    if (ui.shortcutsOpen) {
      ui.setShortcutsOpen(false);
      return;
    }
    useLogStore.getState().select(null);
  };

  const actions: ShortcutHandlers = {
    open: () => void pickAndOpen(),
    refresh: refreshAll,
    commit: commitStaged,
    search: () => {
      if (useRepoStore.getState().repo) {
        setActiveView("history");
        useUiStore.getState().requestSearchFocus();
      }
    },
    viewStatus: () => {
      if (useRepoStore.getState().repo) setActiveView("status");
    },
    viewHistory: () => {
      if (useRepoStore.getState().repo) setActiveView("history");
    },
    viewDiff: () => {
      if (useRepoStore.getState().repo) setActiveView("diff");
    },
    help: toggleShortcuts,
    close: closeOverlayOrSelection,
    prevTab: () => void useRepoStore.getState().switchTab(-1),
    nextTab: () => void useRepoStore.getState().switchTab(1),
  };

  useShortcuts(actions);

  const menuDispatch = (id: string) => {
    switch (id) {
      case "open-repo":
        actions.open?.();
        break;
      case "clone-repo":
        setCloneOpen(true);
        break;
      case "create-repo":
        setCreateOpen(true);
        break;
      case "apply-patch":
        setApplyPatchOpen(true);
        break;
      case "bisect":
        setBisectOpen(true);
        break;
      case "close-repo":
        void useRepoStore.getState().close();
        break;
      case "view-status":
        actions.viewStatus?.();
        break;
      case "view-history":
        actions.viewHistory?.();
        break;
      case "view-diff":
        actions.viewDiff?.();
        break;
      case "toggle-output":
        toggleOutput();
        break;
      case "shortcuts":
        actions.help?.();
        break;
      case "fetch":
        runFetch();
        break;
      case "pull":
        runPull();
        break;
      case "push":
        void runPush();
        break;
      case "merge":
        runMerge();
        break;
      case "refresh":
        void refreshAll();
        break;
      case "documentation":
        void openExternal(PROJECT_URL);
        break;
      case "check-updates":
        void useUpdateStore.getState().check({ manual: true });
        break;
      default:
        break;
    }
  };
  const menuDispatchRef = useRef(menuDispatch);
  useEffect(() => {
    menuDispatchRef.current = menuDispatch;
  });

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    subscribeMenuEvents((id) => menuDispatchRef.current(id))
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // Without a native menu the UI keeps working with the toolbar and shortcuts.
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    // If this fails it is usually because a permission is missing in
    // capabilities/default.json. Silently swallowing the error hid for all of M6
    // that the title was never set: now it shows up in the Output panel.
    void setWindowTitle(repo ? repo.root : "OpenGit").catch((error: unknown) => {
      useUiStore.getState().appendOutput(
        msg("app.couldNotSetTitle", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }, [repo]);

  return (
    <div className="app">
      <Toolbar
        onFetch={runFetch}
        onPull={runPull}
        onPush={() => void runPush()}
        onMerge={runMerge}
        onRefresh={() => void refreshAll()}
        onSettings={() => setSettingsOpen(true)}
        refreshing={refreshing}
      />

      <ShortcutsHelp />

      {repo && fetchOpen && <FetchDialog onClose={() => setFetchOpen(false)} />}
      {repo && pullOpen && <PullDialog onClose={() => setPullOpen(false)} />}
      {repo && mergeOpen && <MergeWindow onClose={() => setMergeOpen(false)} />}
      {cloneOpen && <CloneDialog onClose={() => setCloneOpen(false)} />}
      {createOpen && <CreateDialog onClose={() => setCreateOpen(false)} />}
      {repo && applyPatchOpen && <ApplyPatchDialog onClose={() => setApplyPatchOpen(false)} />}
      {repo && bisectOpen && <BisectStartDialog onClose={() => setBisectOpen(false)} />}
      {settingsOpen && <SettingsWindow onClose={() => setSettingsOpen(false)} />}
      <RemoteJobModal />

      {repo && <OpBanner />}
      {repo && <BisectBanner />}

      <RepoTabs />

      <UpdateDialog />

      <SplitPane
        className="workspace"
        direction="vertical"
        side="end"
        storageKey={LAYOUT_KEYS.output}
        defaultSize={160}
        min={80}
        max={420}
        label={t("output.resize")}
        collapsed={!outputOpen}
      >
        <SplitPane
          className="panes"
          direction="horizontal"
          side="start"
          storageKey={LAYOUT_KEYS.sidebar}
          defaultSize={240}
          min={180}
          max={480}
          label={t("sidebar.resize")}
          collapsed={!repo}
        >
          <aside className="sidebar" aria-label={t("sidebar.repository")}>
            <CollapsibleSection id="workspace" title={t("workspace.title")} icon="workspace">
              <ul>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "status" ? " active" : ""}`}
                    onClick={() => setActiveView("status")}
                  >
                    {t("workspace.status")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "history" ? " active" : ""}`}
                    onClick={() => setActiveView("history")}
                  >
                    {t("workspace.history")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "diff" ? " active" : ""}`}
                    onClick={() => setActiveView("diff")}
                  >
                    {t("workspace.diff")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "conflict" ? " active" : ""}`}
                    onClick={() => setActiveView("conflict")}
                  >
                    {conflictCount > 0
                      ? t("workspace.conflictsCount", { count: conflictCount })
                      : t("workspace.conflicts")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "search" ? " active" : ""}`}
                    onClick={() => setActiveView("search")}
                  >
                    {t("workspace.search")}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`view-button${activeView === "reflog" ? " active" : ""}`}
                    onClick={() => setActiveView("reflog")}
                  >
                    {t("workspace.reflog")}
                  </button>
                </li>
              </ul>
            </CollapsibleSection>

            <RefsSidebar />
            <StashSidebar />
            <ExtrasSidebar />
          </aside>

          <main className="content" aria-label={t("content.history")}>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            {repo ? (
              activeView === "status" ? (
                <StatusView />
              ) : activeView === "diff" ? (
                <DiffView />
              ) : activeView === "conflict" ? (
                <ConflictView />
              ) : activeView === "rebase" ? (
                <RebaseView />
              ) : activeView === "stash" ? (
                <StashView />
              ) : activeView === "blame" ? (
                <BlameView />
              ) : activeView === "search" ? (
                <SearchView />
              ) : activeView === "reflog" ? (
                <ReflogView />
              ) : (
                <HistoryView />
              )
            ) : restoringSession ? null : (
              <Welcome
                loading={loading}
                onOpen={pickAndOpen}
                onClone={() => setCloneOpen(true)}
                onCreate={() => setCreateOpen(true)}
              />
            )}
          </main>
        </SplitPane>

        <section className="output-panel" aria-label={t("output.title")}>
          <h2>{t("output.title")}</h2>
          {outputLines.map((line, index) => (
            <p key={`${index}-${line}`} className="output-line">
              {line}
            </p>
          ))}
        </section>
      </SplitPane>
    </div>
  );
}

function Welcome({
  loading,
  onOpen,
  onClone,
  onCreate,
}: {
  loading: boolean;
  onOpen: () => void;
  onClone: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <h1>{t("welcome.title")}</h1>
      <p>{t("welcome.subtitle")}</p>
      <div className="welcome-actions">
        <button type="button" onClick={onOpen} disabled={loading}>
          {t("welcome.chooseFolder")}
        </button>
        <button type="button" onClick={onClone} disabled={loading}>
          {t("welcome.clone")}
        </button>
        <button type="button" onClick={onCreate} disabled={loading}>
          {t("welcome.create")}
        </button>
      </div>
      <RecentProjects />
    </div>
  );
}

export default App;
