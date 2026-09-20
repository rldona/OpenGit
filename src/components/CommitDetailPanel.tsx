import { useEffect } from "react";
import type { Commit } from "../lib/bridge/types";
import { copyText } from "../lib/clipboard";
import { formatAuthor, formatCommitDate } from "../lib/format";
import { LAYOUT_KEYS } from "../lib/layout";
import { useDiffStore } from "../lib/stores/diff";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { DiffFilesPanel } from "./DiffFilesPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";

/** Espera antes de pedir el diff, para no lanzar una llamada a git por tecla. */
export const COMMIT_DIFF_DEBOUNCE_MS = 120;

type Props = {
  commit: Commit;
};

/**
 * Zona inferior del historial, con la disposición de SourceTree:
 * a la izquierda los controles, la lista de ficheros y, debajo en su propio
 * panel, los metadatos del commit; a la derecha el diff del fichero elegido.
 *
 * Las acciones sobre el commit (cherry-pick, revert, reset, rebase) no viven
 * aquí: están en el menú contextual de la fila del commit.
 */
export function CommitDetailPanel({ commit }: Props) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const openCommit = useDiffStore((state) => state.openCommit);
  const loading = useDiffStore((state) => state.loading);
  const target = useDiffStore((state) => state.target);
  const mode = useDiffStore((state) => state.mode);
  const setMode = useDiffStore((state) => state.setMode);
  const fileTree = useUiStore((state) => state.fileTree);
  const setFileTree = useUiStore((state) => state.setFileTree);

  const hash = commit.hash;

  useEffect(() => {
    if (!root) {
      return;
    }
    // Navegar con el teclado cambia la selección muy rápido: esperamos a que se
    // estabilice. Las respuestas obsoletas las descarta el propio store.
    const timer = window.setTimeout(() => {
      void openCommit(root, hash);
    }, COMMIT_DIFF_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [root, hash, openCommit]);

  const showingCommit = target?.kind === "commit" && target.rev === hash;

  return (
    <section className="commit-detail-panel" aria-label="Commit details">
      <SplitPane
        className="commit-detail-body"
        direction="horizontal"
        side="start"
        storageKey={LAYOUT_KEYS.historyFiles}
        defaultSize={470}
        min={200}
        max={560}
        label="Resize commit file list"
      >
        <div className="commit-left">
          <div className="commit-diff-toolbar">
            <div className="diff-modes">
              <button
                type="button"
                className={mode === "unified" ? "active" : ""}
                onClick={() => setMode("unified")}
              >
                Unified
              </button>
              <button
                type="button"
                className={mode === "side" ? "active" : ""}
                onClick={() => setMode("side")}
              >
                Side by side
              </button>
            </div>
            <div className="diff-modes">
              <button
                type="button"
                className={fileTree ? "" : "active"}
                onClick={() => setFileTree(false)}
              >
                List
              </button>
              <button
                type="button"
                className={fileTree ? "active" : ""}
                onClick={() => setFileTree(true)}
              >
                Tree
              </button>
            </div>
          </div>

          <SplitPane
            className="commit-left-body"
            direction="vertical"
            side="end"
            storageKey={LAYOUT_KEYS.historyMeta}
            defaultSize={150}
            min={80}
            max={400}
            label="Resize commit message"
          >
            <DiffFilesPanel />

            <div className="commit-meta">
              <p className="commit-meta-subject">{commit.subject}</p>
              <p className="commit-meta-line muted">
                {formatAuthor(commit.author_name, commit.author_email)}
                {" · "}
                {formatCommitDate(commit.author_time)}
              </p>
              <p className="commit-meta-line muted">
                <button
                  type="button"
                  className="commit-meta-hash mono"
                  title="Copy hash"
                  onClick={() => void copyText(commit.hash)}
                >
                  {commit.hash.slice(0, 10)}
                </button>
                {" · "}
                {commit.parents.length} parent(s) · {commit.refs.length} ref(s)
                {loading && <span> · Loading…</span>}
              </p>
              {commit.body !== "" && <pre className="commit-meta-body">{commit.body}</pre>}
            </div>
          </SplitPane>
        </div>

        {showingCommit ? (
          <DiffPatchPanel />
        ) : (
          <div className="diff-pane">
            <p className="muted status-empty">Loading commit…</p>
          </div>
        )}
      </SplitPane>
    </section>
  );
}
