import { useEffect, useState } from "react";
import { getAppVersion } from "./lib/bridge/core";
import { useUiStore } from "./lib/stores/ui";

const SECTIONS = [
  { title: "Workspace", items: ["File status", "History"] },
  { title: "Branches", items: [] },
  { title: "Tags", items: [] },
  { title: "Remotes", items: [] },
  { title: "Stashes", items: [] },
] as const;

function App() {
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
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

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">OpenGit</span>
        <span className="tagline">sin repositorio abierto</span>
        <div className="toolbar-actions">
          <span className="core-version">
            {coreVersion ? `núcleo v${coreVersion}` : "núcleo —"}
          </span>
          <button type="button" onClick={toggleOutput} aria-pressed={outputOpen}>
            Salida
          </button>
        </div>
      </header>

      <div className="panes">
        <aside className="sidebar" aria-label="Repositorio">
          {SECTIONS.map((section) => (
            <section key={section.title} className="sidebar-section">
              <h2>{section.title}</h2>
              {section.items.length === 0 ? (
                <p className="muted">Sin repositorio</p>
              ) : (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </aside>

        <main className="content" aria-label="Historial">
          <div className="empty-state">
            <h1>Sin repositorio abierto</h1>
            <p>Abre un repositorio para ver el grafo de commits y su historial.</p>
          </div>
        </main>
      </div>

      {outputOpen && (
        <section className="output-panel" aria-label="Salida">
          <h2>Salida</h2>
          <p className="output-line">OpenGit listo.</p>
        </section>
      )}
    </div>
  );
}

export default App;
