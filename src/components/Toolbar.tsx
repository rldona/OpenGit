import { useEffect, useRef, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { openExternal, openTerminal, revealInFileManager } from "../lib/bridge/opener";
import { useExtrasStore } from "../lib/stores/extras";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useThemeStore } from "../lib/stores/theme";
import { useUiStore } from "../lib/stores/ui";
import type { ThemePreference } from "../lib/theme";
import { Icon, type IconName } from "./Icon";

type Props = {
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onMerge: () => void;
  onRefresh: () => void;
};

function ToolButton({
  icon,
  label,
  badge,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="tool-button" disabled={disabled} onClick={onClick}>
      <span className="tool-icon">
        <Icon name={icon} size={24} />
        {badge !== undefined && badge > 0 && <span className="tool-badge">{badge}</span>}
      </span>
      <span className="tool-label">{label}</span>
    </button>
  );
}

export function Toolbar({ onFetch, onPull, onPush, onMerge, onRefresh }: Props) {
  const repo = useRepoStore((state) => state.repo);
  const loading = useRepoStore((state) => state.loading);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const close = useRepoStore((state) => state.close);
  const remoteRunning = useRemoteStore((state) => state.running);
  const changeCount = useStatusStore((state) => state.report?.entries.length ?? 0);
  const remotes = useExtrasStore((state) => state.remotes);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const toggleOutput = useUiStore((state) => state.toggleOutput);
  const outputOpen = useUiStore((state) => state.outputOpen);
  const toggleShortcuts = useUiStore((state) => state.toggleShortcuts);
  const requestNewBranch = useUiStore((state) => state.requestNewBranch);
  const requestNewStash = useUiStore((state) => state.requestNewStash);
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const root = repo?.root ?? null;
  const busy = remoteRunning;
  const webUrl = remotes.find((remote) => remote.web_url)?.web_url ?? null;

  const runPush = async () => {
    onPush();
  };

  const confirmClose = async () => {
    if (await confirmDestructive("Close this repository?")) {
      await close();
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group toolbar-left">
        {repo ? (
          <>
            <ToolButton
              icon="commit"
              label="Commit"
              badge={changeCount}
              onClick={() => setActiveView("status")}
            />
            <ToolButton icon="download" label="Pull" disabled={busy} onClick={onPull} />
            <ToolButton icon="upload" label="Push" disabled={busy} onClick={() => void runPush()} />
            <ToolButton icon="download" label="Fetch" disabled={busy} onClick={onFetch} />
            <span className="toolbar-divider" />
            <ToolButton icon="branch" label="Branch" onClick={requestNewBranch} />
            <ToolButton icon="merge" label="Merge" onClick={onMerge} />
            <ToolButton icon="stash" label="Stash" onClick={requestNewStash} />
            <ToolButton icon="refresh" label="Refresh" onClick={onRefresh} />
          </>
        ) : (
          <ToolButton
            icon="folder"
            label={loading ? "Opening…" : "Open"}
            disabled={loading}
            onClick={() => void pickAndOpen()}
          />
        )}
      </div>

      <div className="toolbar-title" title={root ?? "No repository open"}>
        {repo ? (
          <>
            <Icon name="folder" size={14} />
            <span className="toolbar-repo-name">{repo.name}</span>
          </>
        ) : (
          <span className="muted">No repository open</span>
        )}
      </div>

      <div className="toolbar-group toolbar-right">
        <ToolButton
          icon="cloud"
          label="View Remote"
          disabled={!webUrl}
          onClick={() => webUrl && void openExternal(webUrl)}
        />
        <ToolButton
          icon="folder"
          label="Show in Finder"
          disabled={!root}
          onClick={() => root && void revealInFileManager(root)}
        />
        <ToolButton
          icon="terminal"
          label="Terminal"
          disabled={!root}
          onClick={() => root && void openTerminal(root)}
        />
        <div className="toolbar-settings" ref={settingsRef}>
          <ToolButton
            icon="settings"
            label="Settings"
            onClick={() => setSettingsOpen((open) => !open)}
          />
          {settingsOpen && (
            <div className="settings-popover" role="dialog" aria-label="Settings">
              <label className="settings-row">
                <span>Theme</span>
                <select
                  aria-label="Theme"
                  value={themePreference}
                  onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <button
                type="button"
                className="settings-item"
                aria-pressed={outputOpen}
                onClick={toggleOutput}
              >
                Toggle output panel
              </button>
              <button type="button" className="settings-item" onClick={toggleShortcuts}>
                Keyboard shortcuts
              </button>
              {repo && (
                <button
                  type="button"
                  className="settings-item danger"
                  onClick={() => void confirmClose()}
                >
                  Close repository
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
