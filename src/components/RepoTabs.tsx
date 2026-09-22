import { useRef, useState } from "react";
import { openRepoInNewWindow } from "../lib/bridge/app";
import { useI18n } from "../lib/i18n";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { useDragSource } from "../lib/hooks/useDragSource";
import { useDragStore } from "../lib/stores/drag";
import { useRepoStore } from "../lib/stores/repo";
import type { Tab } from "../lib/tabs";
import { Icon } from "./Icon";

/**
 * Session tabs for the open repositories (OG-069, OG-070). Hidden with no
 * repo open; with one or more it renders between the toolbar and the content
 * with a `+` button that opens the folder picker. Tabs append on first open
 * and can be reordered by dragging one onto another (OG-107).
 */
export function RepoTabs() {
  const { t } = useI18n();
  const openTabs = useRepoStore((state) => state.openTabs);
  const activeRoot = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const closeTab = useRepoStore((state) => state.closeTab);
  const moveTab = useRepoStore((state) => state.moveTab);
  const renameTab = useRepoStore((state) => state.renameTab);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);
  const menu = useContextMenu();
  const drag = useDragSource((payload, target) => {
    if (payload.kind !== "tab" || !target?.startsWith("tab:")) {
      return;
    }
    moveTab(payload.path, target.slice("tab:".length));
  });
  const dragPayload = useDragStore((state) => state.drag);
  const dragOver = useDragStore((state) => state.over);

  const [editing, setEditing] = useState<{ path: string; value: string } | null>(null);
  // Guards against a second commit from the blur that follows Enter/Escape.
  const settled = useRef(false);

  const startRename = (tab: Tab) => {
    settled.current = false;
    setEditing({ path: tab.path, value: tab.title ?? tab.name });
  };

  const commitRename = () => {
    if (settled.current || editing === null) {
      return;
    }
    settled.current = true;
    renameTab(editing.path, editing.value);
    setEditing(null);
  };

  const cancelRename = () => {
    settled.current = true;
    setEditing(null);
  };

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <nav className="repo-tabs" role="tablist" aria-label={t("tabs.aria")}>
      {openTabs.map((tab) => {
        const active = tab.path === activeRoot;
        const dragging = dragPayload?.kind === "tab" && dragPayload.path === tab.path;
        const dropTarget = dragPayload?.kind === "tab" && dragOver === `tab:${tab.path}`;
        const displayName = tab.title ?? tab.name;
        // While editing, announce the pending label so the close button
        // matches the input instead of the committed name.
        const closeName = editing?.path === tab.path ? editing.value : displayName;
        return (
          <div
            key={tab.path}
            className={`repo-tab${active ? " active" : ""}${dragging ? " dragging" : ""}${
              dropTarget ? " drop-target" : ""
            }`}
            data-drop={`tab:${tab.path}`}
          >
            {editing?.path === tab.path ? (
              <input
                type="text"
                className="repo-tab-input"
                aria-label={t("tabs.renameAria", { name: displayName })}
                value={editing.value}
                autoFocus
                onFocus={(event) => event.target.select()}
                onChange={(event) => setEditing({ path: tab.path, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRename();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={commitRename}
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="repo-tab-open"
                title={tab.path}
                onClick={() => void open(tab.path)}
                onPointerDown={(event) => drag.start(event, { kind: "tab", path: tab.path })}
                onContextMenu={(event) =>
                  menu.open(event, [
                    {
                      label: t("tabs.openInNewWindow"),
                      onSelect: () => void openRepoInNewWindow(tab.path),
                    },
                    {
                      label: t("tabs.rename"),
                      onSelect: () => startRename(tab),
                    },
                  ])
                }
              >
                {displayName}
              </button>
            )}
            <button
              type="button"
              className="repo-tab-close"
              aria-label={t("tabs.close", { name: closeName })}
              title={t("tabs.close", { name: closeName })}
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
