import { useEffect, useState } from "react";
import type { Hook, SubmoduleState } from "../lib/bridge/types";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { hookSetEnabled } from "../lib/bridge/hooks";
import { worktreeRemove, submoduleSync, submoduleUpdate } from "../lib/bridge/repo";
import { shortRefName } from "../lib/format";
import { t as msg, useI18n } from "../lib/i18n";
import { useExtrasStore } from "../lib/stores/extras";
import { useHooksStore } from "../lib/stores/hooks";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { CollapsibleSection } from "./CollapsibleSection";
import { HookDialog } from "./HookDialog";
import { LfsDialog } from "./LfsDialog";
import { WorktreeDialog } from "./WorktreeDialog";

function submoduleStateLabel(state: SubmoduleState): string {
  switch (state) {
    case "clean":
      return msg("extras.submoduleClean");
    case "modified":
      return msg("extras.submoduleModified");
    case "uninitialized":
      return msg("extras.submoduleUninitialized");
    case "conflict":
      return msg("extras.submoduleConflict");
  }
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function pathsEqual(left: string, right: string): boolean {
  const normalize = (path: string) => path.replace(/[\\/]+$/, "");
  return normalize(left) === normalize(right);
}

export function ExtrasSidebar() {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const submodules = useExtrasStore((state) => state.submodules);
  const worktrees = useExtrasStore((state) => state.worktrees);
  const lfs = useExtrasStore((state) => state.lfs);
  const error = useExtrasStore((state) => state.error);
  const load = useExtrasStore((state) => state.load);
  const hooks = useHooksStore((state) => state.hooks);
  const loadHooks = useHooksStore((state) => state.load);
  const sectionMenu = useContextMenu();
  const [worktreeDialog, setWorktreeDialog] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [submoduleError, setSubmoduleError] = useState<string | null>(null);
  const [lfsDialog, setLfsDialog] = useState<"track" | "migrate" | null>(null);
  const [hookDialog, setHookDialog] = useState<Hook | null>(null);
  const [hookError, setHookError] = useState<string | null>(null);

  useEffect(() => {
    if (root) {
      void load(root);
      void loadHooks(root);
    }
  }, [root, load, loadHooks]);

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
        .appendOutput(
          action === "update"
            ? t("extras.submoduleUpdated", { path })
            : t("extras.submoduleSynced", { path }),
        );
    } catch (err) {
      setSubmoduleError(formatGitError(err));
    }
  };

  const pullLfs = async () => {
    if (!root) {
      return;
    }
    if (!(await confirmDestructive(t("extras.lfsPullConfirm")))) {
      return;
    }
    void useRemoteStore.getState().start(root, { kind: "lfs_pull", remote: null });
  };

  const toggleHook = async (hook: Hook) => {
    if (!root) {
      return;
    }
    try {
      await hookSetEnabled(root, hook.name, !hook.active);
      await useHooksStore.getState().refresh(root);
      useUiStore.getState().appendOutput(
        t("extras.hookToggled", {
          action: hook.active ? t("extras.hookDisable") : t("extras.hookEnable"),
          name: hook.name,
        }),
      );
    } catch (err) {
      setHookError(formatGitError(err));
    }
  };

  const removeWorktree = async (path: string) => {
    if (!root) {
      return;
    }
    if (!(await confirmDestructive(t("worktree.removeConfirm", { name: baseName(path) })))) {
      return;
    }
    setWorktreeError(null);
    try {
      await worktreeRemove(root, path, false);
    } catch (err) {
      const confirmed = await confirmDestructive(t("worktree.dirtyConfirm"));
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
    useUiStore.getState().appendOutput(t("worktree.removed", { path }));
  };

  if (!root) {
    return null;
  }
  const showSubmodules = submodules.length > 0;
  const showWorktrees = worktrees.length >= 1;
  const showHooks = hooks.length > 0;
  const showLfs = lfs !== null && (lfs.installed || lfs.configured);
  if (!showSubmodules && !showWorktrees && !showHooks && !showLfs && !error) {
    return null;
  }

  return (
    <>
      {showSubmodules && (
        <CollapsibleSection id="submodules" title={t("extras.submodules")} icon="submodule">
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
                        label: t("extras.updateInit"),
                        onSelect: () => void runSubmodule("update", submodule.path),
                      },
                      {
                        label: t("extras.sync"),
                        onSelect: () => void runSubmodule("sync", submodule.path),
                      },
                      {
                        label: t("common.open"),
                        disabled: submodule.state === "uninitialized",
                        onSelect: () =>
                          void open(`${root.replace(/[\\/]+$/, "")}/${submodule.path}`),
                      },
                    ])
                  }
                >
                  <span className="extra-name">{submodule.path}</span>
                  <span className={`extra-state ${submodule.state}`}>
                    {submoduleStateLabel(submodule.state)}
                  </span>
                </button>
                {submodule.state === "uninitialized" && (
                  <button
                    type="button"
                    className="extra-action"
                    onClick={() => void runSubmodule("update", submodule.path)}
                  >
                    {t("extras.update")}
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
          title={t("extras.worktrees")}
          icon="folder"
          onContextMenu={(event) =>
            sectionMenu.open(event, [
              { label: t("extras.newWorktree"), onSelect: () => setWorktreeDialog(true) },
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
                          label: t("common.open"),
                          disabled: current || worktree.bare,
                          onSelect: () => void open(worktree.path),
                        },
                        {
                          label: t("common.remove"),
                          danger: true,
                          disabled: current || worktree.bare,
                          onSelect: () => void removeWorktree(worktree.path),
                        },
                      ])
                    }
                  >
                    <span className="extra-name">{baseName(worktree.path)}</span>
                    {current && <span className="extra-flag">{t("extras.current")}</span>}
                    {worktree.locked && <span className="extra-flag">{t("extras.locked")}</span>}
                    {worktree.bare && <span className="extra-flag">{t("extras.bare")}</span>}
                    <span className="extra-state">
                      {worktree.detached
                        ? t("extras.detached")
                        : shortRefName(worktree.branch ?? "") || t("extras.unknown")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CollapsibleSection>
      )}

      {showHooks && (
        <CollapsibleSection id="hooks" title={t("extras.hooks")} icon="hook">
          <ul className="refs-list">
            {hooks.map((hook) => (
              <li key={hook.name} className="refs-item">
                <button
                  type="button"
                  className="extra-open"
                  title={hook.path}
                  onClick={() => setHookDialog(hook)}
                  onContextMenu={(event) =>
                    sectionMenu.open(event, [
                      { label: t("extras.hookEdit"), onSelect: () => setHookDialog(hook) },
                      {
                        label: hook.active ? t("extras.hookDisable") : t("extras.hookEnable"),
                        onSelect: () => void toggleHook(hook),
                      },
                    ])
                  }
                >
                  <span className="extra-name">{hook.name}</span>
                  <span className={`extra-state ${hook.active ? "clean" : "modified"}`}>
                    {hook.active
                      ? t("extras.hookActive")
                      : hook.sample && !hook.installed
                        ? t("extras.hookSample")
                        : t("extras.hookDisabled")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {showLfs && lfs && (
        <CollapsibleSection
          id="lfs"
          title={t("extras.gitLfs")}
          icon="cloud"
          onContextMenu={(event) =>
            sectionMenu.open(event, [
              { label: t("extras.lfsTrackPattern"), onSelect: () => setLfsDialog("track") },
              {
                label: t("extras.lfsPull"),
                disabled: !lfs.installed,
                onSelect: () => void pullLfs(),
              },
              {
                label: t("extras.lfsMigrate"),
                danger: true,
                disabled: !lfs.installed,
                onSelect: () => setLfsDialog("migrate"),
              },
            ])
          }
        >
          <p className={lfs.installed ? "muted" : "lfs-missing"}>
            {lfs.installed
              ? (lfs.version ?? t("extras.lfsInstalled"))
              : t("extras.lfsNotInstalled")}
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
            <p className="muted">{t("extras.lfsNoPatterns")}</p>
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

      {hookError && (
        <section className="sidebar-section">
          <p role="alert" className="refs-error">
            {hookError}
          </p>
        </section>
      )}

      {worktreeDialog && <WorktreeDialog onClose={() => setWorktreeDialog(false)} />}
      {lfsDialog && <LfsDialog mode={lfsDialog} onClose={() => setLfsDialog(null)} />}
      {hookDialog && <HookDialog hook={hookDialog} onClose={() => setHookDialog(null)} />}
      {sectionMenu.menu}
    </>
  );
}
