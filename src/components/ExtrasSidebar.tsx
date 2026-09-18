import { useEffect } from "react";
import type { SubmoduleState } from "../lib/bridge/types";
import { shortRefName } from "../lib/format";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";

const STATE_LABELS: Record<SubmoduleState, string> = {
  clean: "Clean",
  modified: "Different commit",
  uninitialized: "Not initialized",
  conflict: "Conflict",
};

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function pathsEqual(left: string, right: string): boolean {
  const normalize = (path: string) => path.replace(/[\\/]+$/, "");
  return normalize(left) === normalize(right);
}

export function ExtrasSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const submodules = useExtrasStore((state) => state.submodules);
  const worktrees = useExtrasStore((state) => state.worktrees);
  const error = useExtrasStore((state) => state.error);
  const load = useExtrasStore((state) => state.load);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  if (!root) {
    return null;
  }
  const showSubmodules = submodules.length > 0;
  const showWorktrees = worktrees.length > 1;
  if (!showSubmodules && !showWorktrees && !error) {
    return null;
  }

  return (
    <>
      {showSubmodules && (
        <section className="sidebar-section">
          <h2>Submodules</h2>
          <ul className="refs-list">
            {submodules.map((submodule) => (
              <li key={submodule.path} className="refs-item">
                <button
                  type="button"
                  className="extra-open"
                  title={`${submodule.path} @ ${submodule.head.slice(0, 7)}`}
                  disabled={submodule.state === "uninitialized"}
                  onClick={() => void open(`${root.replace(/[\\/]+$/, "")}/${submodule.path}`)}
                >
                  <span className="extra-name">{submodule.path}</span>
                  <span className={`extra-state ${submodule.state}`}>
                    {STATE_LABELS[submodule.state]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showWorktrees && (
        <section className="sidebar-section">
          <h2>Worktrees</h2>
          <ul className="refs-list">
            {worktrees.map((worktree) => {
              const current = pathsEqual(worktree.path, root);
              return (
                <li key={worktree.path} className="refs-item">
                  <button
                    type="button"
                    className="extra-open"
                    title={worktree.path}
                    disabled={current || worktree.bare}
                    onClick={() => void open(worktree.path)}
                  >
                    <span className="extra-name">{baseName(worktree.path)}</span>
                    {current && <span className="extra-flag">current</span>}
                    {worktree.locked && <span className="extra-flag">locked</span>}
                    {worktree.bare && <span className="extra-flag">bare</span>}
                    <span className="extra-state">
                      {worktree.detached
                        ? "detached"
                        : shortRefName(worktree.branch ?? "") || "unknown"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && (
        <section className="sidebar-section">
          <p role="alert" className="refs-error">
            {error}
          </p>
        </section>
      )}
    </>
  );
}
