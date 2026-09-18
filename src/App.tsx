import { useEffect, useState } from "react";
import { getAppVersion } from "./lib/bridge/core";
import type { RepoInfo } from "./lib/bridge/types";
import { useRepoStore } from "./lib/stores/repo";
import { useUiStore } from "./lib/stores/ui";

const SECTIONS = [
  { title: "Workspace", items: ["File status", "History"] },
  { title: "Branches", items: [] },
  { title: "Tags", items: [] },
  { title: "Remotes", items: [] },
  { title: "Stashes", items: [] },
];

function App() {
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
  const outputLines = useUiStore((state) => state.outputLines);

  const repo = useRepoStore((state) => state.repo);
  const recents = useRepoStore((state) => state.recents);
  const loading = useRepoStore((state) => state.loading);
  const error = useRepoStore((state) => state.error);
  const loadRecents = useRepoStore((state) => state.loadRecents);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const open = useRepoStore((state) => state.open);
  const removeRecent = useRepoStore((state) => state.removeRecent);

  const [coreVersion, setCoreVersion] = useState<string | null>(null);

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
          <WorkspaceSections hasRepo={repo !== null} />
        </aside>

        <main className="content" aria-label="Historial">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {repo ? <RepoSummary repo={repo} /> : <Welcome loading={loading} onOpen={pickAndOpen} />}
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

function WorkspaceSections({ hasRepo }: { hasRepo: boolean }) {
  return (
    <>
      {SECTIONS.map((section) => (
        <section key={section.title} className="sidebar-section">
          <h2>{section.title}</h2>
          {!hasRepo ? (
            <p className="muted">Sin repositorio</p>
          ) : section.items.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
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

function RepoSummary({ repo }: { repo: RepoInfo }) {
  const branch = repo.detached ? "detached HEAD" : (repo.branch ?? "sin commits");
  return (
    <div className="repo-summary">
      <h1>{repo.name}</h1>
      <p className="repo-root">{repo.root}</p>
      <p className="repo-badges">
        <span className="badge">{branch}</span>
        {repo.head && <span className="mono">{repo.head.slice(0, 7)}</span>}
        <span className="muted">git {repo.git_version}</span>
      </p>
      <p className="muted">
        {repo.has_commits
          ? "Historial listo: el grafo llega en OG-004."
          : "El repositorio todavía no tiene commits."}
      </p>
    </div>
  );
}

export default App;
