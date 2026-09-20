import { useEffect } from "react";
import { useRepoStore } from "../lib/stores/repo";
import { useDiffStore } from "../lib/stores/diff";
import { DiffEditor } from "./DiffEditor";

export function DiffView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const storeRoot = useDiffStore((state) => state.root);
  const target = useDiffStore((state) => state.target);
  const files = useDiffStore((state) => state.files);
  const selected = useDiffStore((state) => state.selected);
  const patch = useDiffStore((state) => state.patch);
  const binary = useDiffStore((state) => state.binary);
  const mode = useDiffStore((state) => state.mode);
  const reversed = useDiffStore((state) => state.reversed);
  const loading = useDiffStore((state) => state.loading);
  const error = useDiffStore((state) => state.error);
  const openWorktree = useDiffStore((state) => state.openWorktree);
  const selectFile = useDiffStore((state) => state.selectFile);
  const setMode = useDiffStore((state) => state.setMode);
  const toggleReverse = useDiffStore((state) => state.toggleReverse);

  useEffect(() => {
    // Solo carga el working tree si no hay un objetivo previo (p. ej. un commit).
    if (root && (storeRoot !== root || target === null)) {
      void openWorktree(root);
    }
  }, [root, storeRoot, target, openWorktree]);

  const label = target?.kind === "commit" ? `commit ${target.rev.slice(0, 7)}` : "Working tree";

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <span className="muted">{label}</span>
        <div className="diff-modes">
          <button
            type="button"
            className={mode === "unified" ? "active" : ""}
            onClick={() => setMode("unified")}
          >
            Unificado
          </button>
          <button
            type="button"
            className={mode === "side" ? "active" : ""}
            onClick={() => setMode("side")}
          >
            Lado a lado
          </button>
        </div>
        <button
          type="button"
          onClick={() => void toggleReverse()}
          aria-pressed={reversed}
          disabled={!selected || selected.untracked}
        >
          Invertir
        </button>
        {loading && <span className="muted">Cargando…</span>}
      </div>

      <div className="diff-body">
        <div className="diff-files">
          {files.length === 0 && <p className="muted status-empty">Sin cambios que mostrar</p>}
          {files.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`diff-file${selected?.key === entry.key ? " selected" : ""}`}
              onClick={() => void selectFile(entry)}
            >
              <span className="diff-file-path">
                {entry.staged && <span className="diff-tag">index</span>}
                {entry.path}
                {entry.orig_path && <span className="muted"> ← {entry.orig_path}</span>}
              </span>
              <span className="diff-counts">
                {entry.untracked ? (
                  <span className="added">nuevo</span>
                ) : (
                  <>
                    <span className="added">+{entry.added ?? 0}</span>
                    <span className="deleted">-{entry.deleted ?? 0}</span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="diff-pane">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {!selected && !error && <p className="muted status-empty">Sin fichero seleccionado</p>}
          {selected?.untracked && (
            <p className="muted status-empty">
              Fichero sin trackear: todavía no hay diff. Haz stage para verlo.
            </p>
          )}
          {selected && !selected.untracked && binary && (
            <p className="muted status-empty">Fichero binario: no hay diff de texto.</p>
          )}
          {selected && !selected.untracked && !binary && patch !== "" && (
            <DiffEditor patch={patch} fileName={selected.path} mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
