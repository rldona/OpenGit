import { copyText } from "../lib/clipboard";
import { useDiffStore, type DiffFileEntry } from "../lib/stores/diff";
import { useUiStore } from "../lib/stores/ui";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { FileTree } from "./FileTree";

/**
 * Lista (o árbol) de ficheros del diff activo, con filtro por ruta.
 * Se alimenta del store, así que sirve igual para el working tree y para un commit.
 */
export function DiffFilesPanel() {
  const files = useDiffStore((state) => state.files);
  const selected = useDiffStore((state) => state.selected);
  const selectFile = useDiffStore((state) => state.selectFile);
  const fileTree = useUiStore((state) => state.fileTree);
  const fileMenu = useContextMenu();

  const renderFileEntry = (entry: DiffFileEntry, displayPath = entry.path) => (
    <button
      type="button"
      className={`diff-file${selected?.key === entry.key ? " selected" : ""}`}
      onClick={() => void selectFile(entry)}
      onContextMenu={(event) =>
        fileMenu.open(event, [
          { label: "Select", onSelect: () => void selectFile(entry) },
          { label: "Copy path", onSelect: () => void copyText(entry.path) },
        ])
      }
    >
      <span className="diff-file-path" title={entry.path}>
        {entry.staged && <span className="diff-tag">index</span>}
        {displayPath}
        {entry.orig_path && <span className="muted"> ← {entry.orig_path}</span>}
      </span>
      <span className="diff-counts">
        {entry.untracked ? (
          <span className="added">new</span>
        ) : (
          <>
            <span className="added">+{entry.added ?? 0}</span>
            <span className="deleted">-{entry.deleted ?? 0}</span>
          </>
        )}
      </span>
    </button>
  );

  return (
    <div className="diff-files">
      {files.length === 0 && <p className="muted status-empty">No changes to show</p>}
      {fileTree ? (
        <FileTree
          items={files}
          pathOf={(entry) => entry.path}
          renderFile={(entry, name) => renderFileEntry(entry, name)}
          renderDirExtra={(dir) => {
            const totals = dir.files.reduce(
              (acc, entry) => ({
                added: acc.added + (entry.added ?? 0),
                deleted: acc.deleted + (entry.deleted ?? 0),
              }),
              { added: 0, deleted: 0 },
            );
            return (
              <span className="diff-counts">
                <span className="added">+{totals.added}</span>
                <span className="deleted">-{totals.deleted}</span>
              </span>
            );
          }}
        />
      ) : (
        files.map((entry) => (
          <div key={entry.key} className="diff-file-row">
            {renderFileEntry(entry)}
          </div>
        ))
      )}
      {fileMenu.menu}
    </div>
  );
}
