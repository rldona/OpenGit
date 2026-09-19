import type { MouseEvent, ReactNode } from "react";
import { useCollapseStore } from "../lib/stores/collapse";
import { Icon, type IconName } from "./Icon";

type Props = {
  /** Stable identifier: the collapsed state is persisted with it. */
  id: string;
  title: string;
  icon?: IconName;
  /** Content to the right of the title (counters, buttons). */
  extra?: ReactNode;
  /** Collapsed the first time, if the user has not touched anything. */
  defaultCollapsed?: boolean;
  /** Visual level: nested sections (a remote) are indented. */
  nested?: boolean;
  /** Header context menu (right click), like SourceTree. */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
};

/**
 * Collapsible sidebar section. The state is stored by `id`, so it survives
 * reloads and does not depend on the order in which the sections are rendered.
 */
export function CollapsibleSection({
  id,
  title,
  icon,
  extra,
  defaultCollapsed = false,
  nested = false,
  onContextMenu,
  children,
}: Props) {
  const collapsed = useCollapseStore((state) => state.collapsed[id] ?? defaultCollapsed);
  const toggle = useCollapseStore((state) => state.toggle);

  return (
    <section className={`sidebar-section${nested ? " nested" : ""}`}>
      <div className="sidebar-heading" onContextMenu={onContextMenu}>
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={!collapsed}
          onClick={() => toggle(id, defaultCollapsed)}
        >
          <span className={`sidebar-chevron${collapsed ? "" : " open"}`}>
            <Icon name="chevron" size={12} />
          </span>
          {icon && (
            <span className="sidebar-section-icon">
              <Icon name={icon} size={13} />
            </span>
          )}
          <span className="sidebar-title">{title}</span>
        </button>
        {extra && <span className="sidebar-heading-extra">{extra}</span>}
      </div>
      {!collapsed && <div className="sidebar-section-body">{children}</div>}
    </section>
  );
}
