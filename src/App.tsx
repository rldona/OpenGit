import { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { ConflictView } from "./components/ConflictView";
import { DiffView } from "./components/DiffView";
import { ExtrasSidebar } from "./components/ExtrasSidebar";
import { HistoryView } from "./components/HistoryView";
import { OpBanner } from "./components/OpBanner";
import { RebaseView } from "./components/RebaseView";
import { RefsSidebar } from "./components/RefsSidebar";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { SplitPane } from "./components/SplitPane";
import { StashSidebar } from "./components/StashSidebar";
import { StatusView } from "./components/StatusView";
import { Toolbar } from "./components/Toolbar";
import { getAppVersion } from "./lib/bridge/core";
import { confirmDestructive } from "./lib/bridge/dialog";
import { subscribeMenuEvents } from "./lib/bridge/events";
import { openExternal } from "./lib/bridge/opener";
import { setWindowTitle } from "./lib/bridge/window";
import { useJobEvents } from "./lib/hooks/useJobEvents";
import { useRepoEvents } from "./lib/hooks/useRepoEvents";
import { useShortcuts, type ShortcutHandlers } from "./lib/hooks/useShortcuts";
import { LAYOUT_KEYS } from "./lib/layout";
import { hasActiveOperation, stagedEntries, useCommitStore } from "./lib/stores/commit";
import { useExtrasStore } from "./lib/stores/extras";
import { useLogStore } from "./lib/stores/log";
import { useRefsStore } from "./lib/stores/refs";
import { useRemoteStore } from "./lib/stores/remote";
import { useRepoStore } from "./lib/stores/repo";
import { useStatusStore } from "./lib/stores/status";
import { useThemeStore } from "./lib/stores/theme";
import { useUiStore } from "./lib/stores/ui";

const PROJECT_URL = "https://github.com/rldona/opengit";

function App() {
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
  const outputLines = useUiStore((state) => state.outputLines);
  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const toggleShortcuts = useUiStore((state) => state.toggleShortcuts);

  const theme = useThemeStore((state) => state.resolved);
  const setSystemDark = useThemeStore((state) => state.setSystemDark);

  const repo = useRepoStore((state) => state.repo);
  const recents = useRepoStore((state) => state.recents);
  const loading = useRepoStore((state) => state.loading);
  const error = useRepoStore((state) => state.error);
  const loadRecents = useRepoStore((state) => state.loadRecents);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const open = useRepoStore((state) => state.open);
  const removeRecent = useRepoStore((state) => state.removeRecent);

  const startRemote = useRemoteStore((state) => state.start);
  const currentBranch = useRefsStore((state) => state.current);
  const currentUpstream = useRefsStore((state) => state.upstream);
  const conflictCount = useStatusStore(
    (state) => state.report?.entries.filter((entry) => entry.kind === "unmerged").length ?? 0,
  );

  const [coreVersion, setCoreVersion] = useState<string | null>(null);

  useRepoEvents(repo?.root ?? null);
  useJobEvents();

  const runFetch = () => {
    if (repo) {
      void startRemote(repo.root, { kind: "fetch", prune: false, remote: null });
    }
  };

  const runPull = () => {
    if (repo) {
      void startRemote(repo.root, { kind: "pull" });
    }
  };

  const runPush = async () => {
    if (!repo) {
      return;
    }
    if (
      (currentBranch === "main" || currentBranch === "master") &&
      !(await confirmDestructive(`Push ${currentBranch} to the remote?`))
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
    let cancelled = false;
    getAppVersion()
      .then((version) => {
        if (!cancelled) setCoreVersion(version);
      })
      .catch(() => {
        if (!cancelled) setCoreVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadRecents();
  }, [loadRecents]);

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

  const refreshAll = () => {
    const root = useRepoStore.getState().repo?.root;
    if (!root) {
      return;
    }
    void useLogStore.getState().reload(root);
    void useStatusStore.getState().refresh(root);
    void useRefsStore.getState().refresh(root);
    void useExtrasStore.getState().refresh(root);
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

  const focusHistorySearch = () => {
    if (!useRepoStore.getState().repo) {
      return;
    }
    setActiveView("history");
    useUiStore.getState().requestSearchFocus();
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
    search: focusHistorySearch,
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
  };

  useShortcuts(actions);

  const menuDispatch = (id: string) => {
    switch (id) {
      case "open-repo":
        actions.open?.();
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
      case "refresh":
        refreshAll();
        break;
      case "documentation":
        void openExternal(PROJECT_URL);
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
        // Sin menú nativo la UI sigue funcionando con la toolbar y los atajos.
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    // Si esto falla suele ser por un permiso que falta en capabilities/default.json.
    // Tragarse el error en silencio escondió durante todo M6 que el título nunca
    // se llegaba a fijar: ahora se ve en el panel de Output.
    void setWindowTitle(repo ? repo.root : "OpenGit").catch((error: unknown) => {
      useUiStore
        .getState()
        .appendOutput(
          `Could not set the window title: ${error instanceof Error ? error.message : String(error)}`,
        );
    });
  }, [repo]);

  return (
    <div className="app">
      <Toolbar
        onFetch={runFetch}
        onPull={runPull}
        onPush={() => void runPush()}
        onRefresh={refreshAll}
      />

      <ShortcutsHelp />

      {repo && <OpBanner />}

      <SplitPane
        className="workspace"
        direction="vertical"
        side="end"
        storageKey={LAYOUT_KEYS.output}
        defaultSize={160}
        min={80}
        max={420}
        label="Resize output"
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
          label="Resize sidebar"
        >
          <aside className="sidebar" aria-label="Repository">
            <CollapsibleSection id="recents" title="Recents" icon="folder" defaultCollapsed>
              {recents.length === 0 ? (
                <p className="muted">No repositories yet</p>
              ) : (
                <ul className="recent-list">
                  {recents.map((recent) => (
                    <li key={recent.path} className="recent-item">
                      <button
                        type="button"
                        className="recent-open"
                        title={recent.path}
                        onClick={() => void open(recent.path)}
                      >
                        {recent.name}
                      </button>
                      <button
                        type="button"
                        className="recent-remove"
                        aria-label={`Remove ${recent.name} from recents`}
                        onClick={() => void removeRecent(recent.path)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleSection>

            <CollapsibleSection id="workspace" title="Workspace" icon="workspace">
              {repo ? (
                <ul>
                  <li>
                    <button
                      type="button"
                      className={`view-button${activeView === "status" ? " active" : ""}`}
                      onClick={() => setActiveView("status")}
                    >
                      File status
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`view-button${activeView === "history" ? " active" : ""}`}
                      onClick={() => setActiveView("history")}
                    >
                      History
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`view-button${activeView === "diff" ? " active" : ""}`}
                      onClick={() => setActiveView("diff")}
                    >
                      Diff
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`view-button${activeView === "conflict" ? " active" : ""}`}
                      onClick={() => setActiveView("conflict")}
                    >
                      Conflicts{conflictCount > 0 ? ` (${conflictCount})` : ""}
                    </button>
                  </li>
                </ul>
              ) : (
                <p className="muted">No repository open</p>
              )}
            </CollapsibleSection>

            {repo ? (
              <RefsSidebar />
            ) : (
              <CollapsibleSection id="branches" title="Branches" icon="branch">
                <p className="muted">No repository open</p>
              </CollapsibleSection>
            )}

            {repo ? (
              <StashSidebar />
            ) : (
              <CollapsibleSection id="stashes" title="Stashes" icon="stash">
                <p className="muted">No repository open</p>
              </CollapsibleSection>
            )}

            <ExtrasSidebar />
          </aside>

          <main className="content" aria-label="History">
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
              ) : (
                <HistoryView />
              )
            ) : (
              <Welcome loading={loading} onOpen={pickAndOpen} />
            )}
          </main>
        </SplitPane>

        <section className="output-panel" aria-label="Output">
          <h2>Output</h2>
          {outputLines.map((line, index) => (
            <p key={`${index}-${line}`} className="output-line">
              {line}
            </p>
          ))}
        </section>
      </SplitPane>

      <footer className="status-bar">
        {/* Ni los cambios ni los conflictos se repiten aquí: los cambios ya van
            en el badge de Commit y los conflictos en la sidebar. */}
        <span>{repo ? (currentBranch ?? "detached HEAD") : "No repository"}</span>
        <span className="status-spacer" />
        <span className="core-version">{coreVersion ? `core v${coreVersion}` : "core —"}</span>
      </footer>
    </div>
  );
}

function Welcome({ loading, onOpen }: { loading: boolean; onOpen: () => void }) {
  return (
    <div className="empty-state">
      <h1>No repository open</h1>
      <p>Open a repository to see its commit graph and history.</p>
      <button type="button" onClick={onOpen} disabled={loading}>
        Choose folder
      </button>
    </div>
  );
}

export default App;
