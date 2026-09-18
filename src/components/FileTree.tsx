import { useState, type ReactNode } from "react";
import { buildFileTree, type FileTreeDir, type FileTreeNode } from "../lib/tree";

type Props<T> = {
  items: T[];
  pathOf: (item: T) => string;
  renderFile: (item: T, name: string) => ReactNode;
  /** Extra para la cabecera del directorio (p. ej. contadores agregados). */
  renderDirExtra?: (dir: FileTreeDir<T>) => ReactNode;
};

export function FileTree<T>({ items, pathOf, renderFile, renderDirExtra }: Props<T>) {
  const nodes = buildFileTree(items, pathOf);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

  const renderNodes = (children: FileTreeNode<T>[], depth: number): ReactNode =>
    children.map((node) => {
      if (node.kind === "file") {
        return (
          <li key={`file:${node.path}`} className="file-tree-row">
            <div className="file-tree-file" style={{ paddingLeft: depth * 14 }}>
              {renderFile(node.item, node.name)}
            </div>
          </li>
        );
      }
      const isCollapsed = collapsed.has(node.path);
      return (
        <li key={`dir:${node.path}`} className="file-tree-row">
          <button
            type="button"
            className="file-tree-dir"
            style={{ paddingLeft: depth * 14 }}
            aria-expanded={!isCollapsed}
            onClick={() => toggle(node.path)}
          >
            <span className="file-tree-caret">{isCollapsed ? "▸" : "▾"}</span>
            <span className="file-tree-name">{node.name}/</span>
            {renderDirExtra?.(node)}
          </button>
          {!isCollapsed && (
            <ul className="file-tree-children">{renderNodes(node.children, depth + 1)}</ul>
          )}
        </li>
      );
    });

  return <ul className="file-tree">{renderNodes(nodes, 0)}</ul>;
}
