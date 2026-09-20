import { useEffect, useState } from "react";
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
        <span className="tagline">{repo ? repo.root : "sin repositorio abierto"}</span>
        <div className="toolbar-actions">
          <span className="core-version">
            {coreVersion ? `núcleo v${coreVersion}` : "núcleo —"}
          </span>
          {repo && (
            <button type="button" onClick={() => void close()}>
              Cerrar
            </button>
          )}
          <button type="button" onClick={() => void pickAndOpen()} disabled={loading}>
            {loading ? "Abriendo…" : "Abrir repositorio"}
          </button>
          <button type="button" onClick={toggleOutput} aria-pressed={outputOpen}>
            Salida
          </button>
        </div>
      </header>

      <div className="panes">
        <aside className="sidebar" aria-label="Repositorio">
          <section className="sidebar-section">
            <h2>Recientes</h2>
            {recents.length === 0 ? (
              <p className="muted">Todavía no hay repositorios</p>
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
                      aria-label={`Quitar ${recent.name} de recientes`}
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
              </ul>
            ) : (
              <p className="muted">Sin repositorio</p>
            )}
          </section>

          {["Branches", "Tags", "Remotes", "Stashes"].map((title) => (
            <section key={title} className="sidebar-section">
              <h2>{title}</h2>
              <p className="muted">{repo ? "—" : "Sin repositorio"}</p>
            </section>
          ))}
        </aside>

        <main className="content" aria-label="Historial">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {repo ? (
            activeView === "status" ? (
              <StatusView />
            ) : (
              <HistoryView />
            )
          ) : (
            <Welcome loading={loading} onOpen={pickAndOpen} />
          )}
        </main>
      </div>

      {outputOpen && (
        <section className="output-panel" aria-label="Salida">
          <h2>Salida</h2>
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
      <h1>Sin repositorio abierto</h1>
      <p>Abre un repositorio para ver el grafo de commits y su historial.</p>
      <button type="button" onClick={onOpen} disabled={loading}>
        Seleccionar carpeta
      </button>
    </div>
  );
}

export default App;
