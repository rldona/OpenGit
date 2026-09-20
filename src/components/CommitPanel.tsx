import { useEffect, useRef, useState } from "react";
import { hasActiveOperation, stagedEntries, useCommitStore } from "../lib/stores/commit";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";

/**
 * Pie del área de commit, con la disposición de SourceTree: identidad de git,
 * opciones plegadas, mensaje, push inmediato opcional y Cancel/Commit.
 */
export function CommitPanel() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const report = useStatusStore((state) => state.report);
  const message = useCommitStore((state) => state.message);
  const amend = useCommitStore((state) => state.amend);
  const author = useCommitStore((state) => state.author);
  const opState = useCommitStore((state) => state.opState);
  const loading = useCommitStore((state) => state.loading);
  const error = useCommitStore((state) => state.error);
  const load = useCommitStore((state) => state.load);
  const setMessage = useCommitStore((state) => state.setMessage);
  const setAmend = useCommitStore((state) => state.setAmend);
  const submit = useCommitStore((state) => state.submit);
  const upstream = useRefsStore((state) => state.upstream);
  const remoteCount = useExtrasStore((state) => state.remotes.length);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pushImmediately, setPushImmediately] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  useEffect(() => {
    if (!optionsOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) {
        setOptionsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOptionsOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [optionsOpen]);

  const staged = stagedEntries(report);
  const operationActive = hasActiveOperation(opState);
  const pushLabel = upstream
    ? `Push changes immediately to ${upstream}`
    : "Push changes immediately";

  const commit = async () => {
    const ok = await submit(staged.length);
    if (ok && pushImmediately && root) {
      void useRemoteStore.getState().start(root, {
        kind: "push",
        remote: null,
        set_upstream: upstream === null,
      });
    }
  };

  const cancel = () => {
    setPushImmediately(false);
    void setAmend(false);
  };

  return (
    <section className="commit-panel" aria-label="Commit">
      <div className="commit-author">
        <span className="commit-avatar" aria-hidden="true">
          {author ? author.name.trim().charAt(0).toUpperCase() : "?"}
        </span>
        <span className="commit-author-name">
          {author ? `${author.name} <${author.email}>` : "No git identity configured"}
        </span>
        <div className="commit-options" ref={optionsRef}>
          <button
            type="button"
            aria-label="Commit Options"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            Commit Options… <span aria-hidden="true">⌄</span>
          </button>
          {optionsOpen && (
            <div className="commit-options-menu" role="menu">
              <label className="settings-row">
                <input
                  type="checkbox"
                  checked={amend}
                  onChange={(event) => void setAmend(event.target.checked)}
                />
                Amend last commit
              </label>
            </div>
          )}
        </div>
      </div>

      <textarea
        className="commit-message"
        aria-label="Commit message"
        placeholder="Commit message"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />

      <div className="commit-footer">
        <label
          className="commit-push"
          title={remoteCount === 0 ? "No remote configured" : undefined}
        >
          <input
            type="checkbox"
            checked={pushImmediately}
            disabled={remoteCount === 0}
            onChange={(event) => setPushImmediately(event.target.checked)}
          />
          {pushLabel}
        </label>
        <button type="button" className="commit-cancel" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          className="commit-submit"
          onClick={() => void commit()}
          disabled={loading || operationActive}
        >
          {amend ? "Amend" : "Commit"}
        </button>
      </div>

      {error && (
        <p role="alert" className="error-banner commit-error">
          {error}
        </p>
      )}
    </section>
  );
}
