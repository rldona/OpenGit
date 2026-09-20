import { openRepoInNewWindow } from "../lib/bridge/app";
import { useI18n } from "../lib/i18n";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { useRepoStore } from "../lib/stores/repo";
import { Icon } from "./Icon";

/**
 * Session tabs for the open repositories (OG-069, OG-070). Hidden with no
 * repo open; with one or more it renders between the toolbar and the content
 * with a `+` button that opens the folder picker. Order is fixed (append on
 * first open, never reorder on switch).
 */
export function RepoTabs() {
  const { t } = useI18n();
  const openTabs = useRepoStore((state) => state.openTabs);
  const activeRoot = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const closeTab = useRepoStore((state) => state.closeTab);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const menu = useContextMenu();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <nav className="repo-tabs" role="tablist" aria-label={t("tabs.aria")}>
      {openTabs.map((tab) => {
        const active = tab.path === activeRoot;
        return (
          <div key={tab.path} className={`repo-tab${active ? " active" : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="repo-tab-open"
              title={tab.path}
              onClick={() => void open(tab.path)}
              onContextMenu={(event) =>
                menu.open(event, [
                  {
                    label: t("tabs.openInNewWindow"),
                    onSelect: () => void openRepoInNewWindow(tab.path),
                  },
                ])
              }
            >
              {tab.name}
            </button>
            <button
              type="button"
              className="repo-tab-close"
              aria-label={t("tabs.close", { name: tab.name })}
              title={t("tabs.close", { name: tab.name })}
              onClick={() => void closeTab(tab.path)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="repo-tab-add"
        aria-label={t("tabs.openAnother")}
        title={t("tabs.openAnother")}
        onClick={() => void pickAndOpen()}
      >
        <Icon name="plus" size={14} />
      </button>
      {menu.menu}
    </nav>
  );
}
