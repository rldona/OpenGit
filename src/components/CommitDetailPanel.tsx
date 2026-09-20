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

/** Delay before requesting the diff, so as not to launch a git call per keystroke. */
export const COMMIT_DIFF_DEBOUNCE_MS = 120;

type Props = {
  commit: Commit;
};

/**
 * Lower area of the history, with the SourceTree layout:
 * on the left the controls, the file list and, below in its own panel,
 * the commit metadata; on the right the diff of the selected file.
 *
 * Actions on the commit (cherry-pick, revert, reset, rebase) do not live
 * here: they are in the context menu of the commit row.
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
    // Navigating with the keyboard changes the selection very fast: we wait for
    // it to settle. Stale responses are discarded by the store itself.
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
