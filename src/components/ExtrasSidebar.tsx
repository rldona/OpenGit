import { useEffect, useState } from "react";
import type { SubmoduleState } from "../lib/bridge/types";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { worktreeRemove, submoduleSync, submoduleUpdate } from "../lib/bridge/repo";
import { shortRefName } from "../lib/format";
import { useExtrasStore } from "../lib/stores/extras";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { CollapsibleSection } from "./CollapsibleSection";
import { LfsDialog } from "./LfsDialog";
import { WorktreeDialog } from "./WorktreeDialog";

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
  const lfs = useExtrasStore((state) => state.lfs);
  const error = useExtrasStore((state) => state.error);
  const load = useExtrasStore((state) => state.load);
  const sectionMenu = useContextMenu();
  const [worktreeDialog, setWorktreeDialog] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [submoduleError, setSubmoduleError] = useState<string | null>(null);
  const [lfsDialog, setLfsDialog] = useState<"track" | "migrate" | null>(null);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const runSubmodule = async (action: "update" | "sync", path: string) => {
    if (!root) {
      return;
    }
    setSubmoduleError(null);
    try {
      const output =
        action === "update" ? await submoduleUpdate(root, true, true) : await submoduleSync(root);
      for (const line of output.split("\n")) {
        if (line.trim() !== "") {
          useUiStore.getState().appendOutput(line);
        }
      }
      await useExtrasStore.getState().refresh(root);
      await useStatusStore.getState().refresh(root);
      useUiStore
        .getState()
        .appendOutput(`Submodule ${path} ${action === "update" ? "updated" : "synced"}`);
    } catch (err) {
      setSubmoduleError(formatGitError(err));
    }
  };

  const pullLfs = async () => {
    if (!root) {
      return;
    }
    if (
      !(await confirmDestructive("Download the Git LFS objects missing for the current branch?"))
    ) {
      return;
    }
    void useRemoteStore.getState().start(root, { kind: "lfs_pull", remote: null });
  };

  const removeWorktree = async (path: string) => {
    if (!root) {
      return;
    }
    if (!(await confirmDestructive(`Remove worktree ${baseName(path)}?`))) {
      return;
    }
    setWorktreeError(null);
    try {
      await worktreeRemove(root, path, false);
    } catch (err) {
      const confirmed = await confirmDestructive(
        "The worktree has uncommitted changes. Remove it anyway? This cannot be undone.",
      );
      if (!confirmed) {
        setWorktreeError(formatGitError(err));
        return;
      }
      try {
        await worktreeRemove(root, path, true);
      } catch (forceError) {
        setWorktreeError(formatGitError(forceError));
        return;
      }
    }
    await useExtrasStore.getState().refresh(root);
    useUiStore.getState().appendOutput(`Worktree removed: ${path}`);
  };

  if (!root) {
    return null;
  }
  const showSubmodules = submodules.length > 0;
  const showWorktrees = worktrees.length >= 1;
  const showLfs = lfs !== null && (lfs.installed || lfs.configured);
  if (!showSubmodules && !showWorktrees && !showLfs && !error) {
    return null;
  }

  return (
    <>
      {showSubmodules && (
        <CollapsibleSection id="submodules" title="Submodules" icon="submodule">
          <ul className="refs-list">
            {submodules.map((submodule) => (
              <li key={submodule.path} className="refs-item">
                <button
                  type="button"
                  className="extra-open"
                  title={`${submodule.path} @ ${submodule.head.slice(0, 7)}`}
                  disabled={submodule.state === "uninitialized"}
                  onClick={() => void open(`${root.replace(/[\\/]+$/, "")}/${submodule.path}`)}
                  onContextMenu={(event) =>
                    sectionMenu.open(event, [
                      {
                        label: "Update (init included)",
                        onSelect: () => void runSubmodule("update", submodule.path),
                      },
                      { label: "Sync", onSelect: () => void runSubmodule("sync", submodule.path) },
                      {
                        label: "Open",
                        disabled: submodule.state === "uninitialized",
                        onSelect: () =>
                          void open(`${root.replace(/[\\/]+$/, "")}/${submodule.path}`),
                      },
                    ])
                  }
                >
                  <span className="extra-name">{submodule.path}</span>
                  <span className={`extra-state ${submodule.state}`}>
                    {STATE_LABELS[submodule.state]}
                  </span>
                </button>
                {submodule.state === "uninitialized" && (
                  <button
                    type="button"
                    className="extra-action"
                    onClick={() => void runSubmodule("update", submodule.path)}
                  >
                    Update
                  </button>
                )}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {showWorktrees && (
        <CollapsibleSection
          id="worktrees"
          title="Worktrees"
          icon="folder"
          onContextMenu={(event) =>
            sectionMenu.open(event, [
              { label: "New worktree…", onSelect: () => setWorktreeDialog(true) },
            ])
          }
        >
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
                    onContextMenu={(event) =>
                      sectionMenu.open(event, [
                        {
                          label: "Open",
                          disabled: current || worktree.bare,
                          onSelect: () => void open(worktree.path),
                        },
                        {
                          label: "Remove",
                          danger: true,
                          disabled: current || worktree.bare,
                          onSelect: () => void removeWorktree(worktree.path),
                        },
                      ])
                    }
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
        </CollapsibleSection>
      )}

      {showLfs && lfs && (
        <CollapsibleSection
          id="lfs"
          title="Git LFS"
          icon="cloud"
          onContextMenu={(event) =>
            sectionMenu.open(event, [
              { label: "Track pattern…", onSelect: () => setLfsDialog("track") },
              {
                label: "Pull objects",
                disabled: !lfs.installed,
                onSelect: () => void pullLfs(),
              },
              {
                label: "Migrate to LFS…",
                danger: true,
                disabled: !lfs.installed,
                onSelect: () => setLfsDialog("migrate"),
              },
            ])
          }
        >
          <p className={lfs.installed ? "muted" : "lfs-missing"}>
            {lfs.installed ? (lfs.version ?? "Installed") : "Not installed"}
          </p>
          {lfs.patterns.length > 0 ? (
            <ul className="refs-list">
              {lfs.patterns.map((pattern) => (
                <li key={pattern} className="refs-item">
                  <span className="extra-name">{pattern}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No patterns tracked</p>
          )}
        </CollapsibleSection>
      )}

      {error && (
        <section className="sidebar-section">
          <p role="alert" className="refs-error">
            {error}
          </p>
        </section>
      )}

      {worktreeError && (
        <section className="sidebar-section">
          <p role="alert" className="refs-error">
            {worktreeError}
          </p>
        </section>
      )}

      {submoduleError && (
        <section className="sidebar-section">
          <p role="alert" className="refs-error">
            {submoduleError}
          </p>
        </section>
      )}

      {worktreeDialog && <WorktreeDialog onClose={() => setWorktreeDialog(false)} />}
      {lfsDialog && <LfsDialog mode={lfsDialog} onClose={() => setLfsDialog(null)} />}
      {sectionMenu.menu}
    </>
  );
}
