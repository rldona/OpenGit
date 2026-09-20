import { useEffect } from "react";
import { conflictCount, resolvedContent, type ConflictBlock } from "../lib/conflict/parse";
import { useConflictStore } from "../lib/stores/conflict";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";

type IndexedBlock = {
  block: ConflictBlock;
  conflictIndex: number | null;
};

function indexBlocks(blocks: ConflictBlock[]): IndexedBlock[] {
  let conflictIndex = -1;
  return blocks.map((block) => {
    if (block.kind === "common") {
      return { block, conflictIndex: null };
    }
    conflictIndex += 1;
    return { block, conflictIndex };
  });
}

export function ConflictView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const report = useStatusStore((state) => state.report);
  const file = useConflictStore((state) => state.file);
  const blocks = useConflictStore((state) => state.blocks);
  const choices = useConflictStore((state) => state.choices);
  const binary = useConflictStore((state) => state.binary);
  const loading = useConflictStore((state) => state.loading);
  const error = useConflictStore((state) => state.error);
  const open = useConflictStore((state) => state.open);
  const choose = useConflictStore((state) => state.choose);
  const undecide = useConflictStore((state) => state.undecide);
  const save = useConflictStore((state) => state.save);

  const conflicts = (report?.entries ?? []).filter((entry) => entry.kind === "unmerged");

  useEffect(() => {
    if (root && !file && conflicts.length > 0) {
      void open(root, conflicts[0].path);
    }
  }, [root, file, conflicts, open]);

  const total = conflictCount(blocks);
  const { unresolved } = resolvedContent(blocks, choices);
  const indexed = indexBlocks(blocks);
  const noMarkers = !binary && file !== null && total === 0 && !loading;

  return (
    <div className="conflict-view">
      <div className="conflict-toolbar">
        <span className="muted">
          {conflicts.length} conflicted file(s)
          {file && total > 0 ? ` · ${total - unresolved}/${total} blocks resolved` : ""}
        </span>
        <button
          type="button"
          disabled={!file || total === 0 || unresolved > 0 || binary || loading}
          onClick={() => {
            if (root) {
              void save(root);
            }
          }}
        >
          Save and stage
        </button>
      </div>

      <div className="conflict-body">
        <div className="conflict-files">
          {conflicts.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={`conflict-file${file === entry.path ? " selected" : ""}`}
              onClick={() => {
                if (root) {
                  void open(root, entry.path);
                }
              }}
            >
              {entry.path}
            </button>
          ))}
          {conflicts.length === 0 && <p className="muted status-empty">No conflicts</p>}
        </div>

        <div className="conflict-pane">
          {binary && (
            <p className="muted status-empty">
              Binary or non-UTF-8 file: resolve it outside the app.
            </p>
          )}
          {noMarkers && (
            <p className="muted status-empty">
              No conflict markers found (delete/modify?): resolve it outside the app.
            </p>
          )}
          {!binary &&
            indexed.map(({ block, conflictIndex }, position) =>
              block.kind === "common" ? (
                <pre key={`common-${position}`} className="conflict-common">
                  {block.lines.join("\n")}
                </pre>
              ) : (
                <div key={`conflict-${conflictIndex}`} className="conflict-block">
                  <div className="conflict-sides">
                    <div className="conflict-side">
                      <span className="conflict-label">
                        Ours{block.oursLabel ? ` (${block.oursLabel})` : ""}
                      </span>
                      <pre>{block.ours.join("\n")}</pre>
                    </div>
                    <div className="conflict-side">
                      <span className="conflict-label">
                        Theirs{block.theirsLabel ? ` (${block.theirsLabel})` : ""}
                      </span>
                      <pre>{block.theirs.join("\n")}</pre>
                    </div>
                  </div>
                  <div className="conflict-actions">
                    <button
                      type="button"
                      className={choices[conflictIndex!] === "ours" ? "active" : ""}
                      onClick={() => choose(conflictIndex!, "ours")}
                    >
                      Take ours
                    </button>
                    <button
                      type="button"
                      className={choices[conflictIndex!] === "theirs" ? "active" : ""}
                      onClick={() => choose(conflictIndex!, "theirs")}
                    >
                      Take theirs
                    </button>
                    <button
                      type="button"
                      className={choices[conflictIndex!] === "both" ? "active" : ""}
                      onClick={() => choose(conflictIndex!, "both")}
                    >
                      Take both
                    </button>
                    {choices[conflictIndex!] && (
                      <button type="button" onClick={() => undecide(conflictIndex!)}>
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
