import type { MouseEvent, ReactNode } from "react";
import { useCollapseStore } from "../lib/stores/collapse";
import { Icon, type IconName } from "./Icon";

type Props = {
  /** Identificador estable: con él se persiste el plegado. */
  id: string;
  title: string;
  icon?: IconName;
  /** Contenido a la derecha del título (contadores, botones). */
  extra?: ReactNode;
  /** Plegada la primera vez, si el usuario no ha tocado nada. */
  defaultCollapsed?: boolean;
  /** Nivel visual: las secciones anidadas (un remoto) van con sangría. */
  nested?: boolean;
  /** Menú contextual de la cabecera (botón derecho), como SourceTree. */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
};

/**
 * Sección plegable de la sidebar. El estado se guarda por `id`, así que
 * sobrevive a recargas y no depende del orden en que se pinten las secciones.
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
