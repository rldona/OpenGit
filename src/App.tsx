import { useEffect, useState } from "react";
import { DiffView } from "./components/DiffView";
import { HistoryView } from "./components/HistoryView";
import { StatusView } from "./components/StatusView";
import { getAppVersion } from "./lib/bridge/core";
import { useRepoEvents } from "./lib/hooks/useRepoEvents";
import { useRepoStore } from "./lib/stores/repo";
import { useUiStore } from "./lib/stores/ui";

function App() {
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
  const outputLines = useUiStore((state) => state.outputLines);
  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const repo = useRepoStore((state) => state.repo);
  const recents = useRepoStore((state) => state.recents);
  const loading = useRepoStore((state) => state.loading);
  const error = useRepoStore((state) => state.error);
  const loadRecents = useRepoStore((state) => state.loadRecents);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const open = useRepoStore((state) => state.open);
  const removeRecent = useRepoStore((state) => state.removeRecent);
  const close = useRepoStore((state) => state.close);

  const [coreVersion, setCoreVersion] = useState<string | null>(null);

  useRepoEvents(repo?.root ?? null);

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

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">OpenGit</span>
        <span className="tagline">{repo ? repo.root : "no repository open"}</span>
        <div className="toolbar-actions">
          <span className="core-version">{coreVersion ? `core v${coreVersion}` : "core —"}</span>
          {repo && (
            <button type="button" onClick={() => void close()}>
              Close
            </button>
          )}
          <button type="button" onClick={() => void pickAndOpen()} disabled={loading}>
            {loading ? "Opening…" : "Open repository"}
          </button>
          <button type="button" onClick={toggleOutput} aria-pressed={outputOpen}>
            Output
          </button>
        </div>
      </header>

      <div className="panes">
        <aside className="sidebar" aria-label="Repository">
          <section className="sidebar-section">
            <h2>Recents</h2>
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
          </section>

          <section className="sidebar-section">
            <h2>Workspace</h2>
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
              </ul>
            ) : (
              <p className="muted">No repository open</p>
            )}
          </section>

          {["Branches", "Tags", "Remotes", "Stashes"].map((title) => (
            <section key={title} className="sidebar-section">
              <h2>{title}</h2>
              <p className="muted">{repo ? "—" : "No repository open"}</p>
            </section>
          ))}
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
            ) : (
              <HistoryView />
            )
          ) : (
            <Welcome loading={loading} onOpen={pickAndOpen} />
          )}
        </main>
      </div>

      {outputOpen && (
        <section className="output-panel" aria-label="Output">
          <h2>Output</h2>
          {outputLines.map((line, index) => (
            <p key={`${index}-${line}`} className="output-line">
              {line}
            </p>
          ))}
        </section>
      )}
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
