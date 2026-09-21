import { openExternal, openTerminal, revealInFileManager } from "../lib/bridge/opener";
import { useI18n } from "../lib/i18n";
import { useExtrasStore } from "../lib/stores/extras";
import { useRemoteStore } from "../lib/stores/remote";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { isMacPlatform } from "../lib/shortcuts";
import { Icon, type IconName } from "./Icon";

type Props = {
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onMerge: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  refreshing?: boolean;
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

export function Toolbar({
  onFetch,
  onPull,
  onPush,
  onMerge,
  onRefresh,
  onSettings,
  refreshing = false,
}: Props) {
  const { t } = useI18n();
  const repo = useRepoStore((state) => state.repo);
  const loading = useRepoStore((state) => state.loading);
  // The active tab already names the repo: hide the header title while
  // tabs are visible to avoid showing it twice (OG-070).
  const showTabs = useRepoStore((state) => state.openTabs.length > 0);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const remoteRunning = useRemoteStore((state) => state.running);
  const merging = useRefsStore((state) => state.merging);
  const changeCount = useStatusStore((state) => state.report?.entries.length ?? 0);
  const remotes = useExtrasStore((state) => state.remotes);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const requestNewBranch = useUiStore((state) => state.requestNewBranch);
  const requestNewStash = useUiStore((state) => state.requestNewStash);

  const root = repo?.root ?? null;
  const busy = remoteRunning;
  const webUrl = remotes.find((remote) => remote.web_url)?.web_url ?? null;

  const runPush = async () => {
    onPush();
  };

  // macOS overlay title bar: the repo name is centered on its own title row,
  // like SourceTree, and the toolbar below only holds the buttons. On
  // Windows/Linux the native title bar is used, so the name stays in the
  // toolbar.
  const overlayTitle = isMacPlatform();
  const title = (
    <div className="toolbar-title" title={root ?? t("toolbar.noRepo")}>
      {repo ? (
        <>
          <Icon name="folder" size={14} />
          <span className="toolbar-repo-name">{repo.name}</span>
        </>
      ) : (
        <span className="muted">{t("toolbar.noRepo")}</span>
      )}
    </div>
  );

  return (
    <>
      {overlayTitle && (
        <div className="titlebar" data-tauri-drag-region>
          {!showTabs && title}
        </div>
      )}
      <header className="toolbar" data-tauri-drag-region>
        <div className="toolbar-group toolbar-left">
          {repo ? (
            <>
              <ToolButton
                icon="commit"
                label={t("toolbar.commit")}
                badge={changeCount}
                onClick={() => setActiveView("status")}
              />
              <ToolButton
                icon="download"
                label={t("toolbar.pull")}
                disabled={busy}
                onClick={onPull}
              />
              <ToolButton
                icon="upload"
                label={t("toolbar.push")}
                disabled={busy}
                onClick={() => void runPush()}
              />
              <ToolButton
                icon="download"
                label={t("toolbar.fetch")}
                disabled={busy}
                onClick={onFetch}
              />
              <span className="toolbar-divider" />
              <ToolButton icon="branch" label={t("toolbar.branch")} onClick={requestNewBranch} />
              <ToolButton
                icon="merge"
                label={merging ? t("toolbar.merging") : t("toolbar.merge")}
                disabled={merging}
                onClick={onMerge}
              />
              <ToolButton icon="stash" label={t("toolbar.stash")} onClick={requestNewStash} />
              <ToolButton
                icon="refresh"
                label={refreshing ? t("toolbar.refreshing") : t("toolbar.refresh")}
                disabled={refreshing}
                onClick={onRefresh}
              />
            </>
          ) : (
            <ToolButton
              icon="folder"
              label={loading ? t("toolbar.opening") : t("toolbar.open")}
              disabled={loading}
              onClick={() => void pickAndOpen()}
            />
          )}
        </div>

        {!overlayTitle && !showTabs && title}

        <div className="toolbar-group toolbar-right">
          <ToolButton
            icon="cloud"
            label={t("toolbar.viewRemote")}
            disabled={!webUrl}
            onClick={() => webUrl && void openExternal(webUrl)}
          />
          <ToolButton
            icon="folder"
            label={t("toolbar.showInFinder")}
            disabled={!root}
            onClick={() => root && void revealInFileManager(root)}
          />
          <ToolButton
            icon="terminal"
            label={t("toolbar.terminal")}
            disabled={!root}
            onClick={() => root && void openTerminal(root)}
          />
          <ToolButton icon="settings" label={t("toolbar.settings")} onClick={onSettings} />
        </div>
      </header>
    </>
  );
}
