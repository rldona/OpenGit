import { useEffect } from "react";
import { LAYOUT_KEYS } from "../lib/layout";
import { useDiffStore } from "../lib/stores/diff";
import { DiffFilesPanel } from "./DiffFilesPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";

/** Panel inferior de la fila "Uncommitted changes": ficheros y parche del working tree. */
export function WorktreeDetailPanel({ root }: { root: string }) {
  const openWorktree = useDiffStore((state) => state.openWorktree);

  useEffect(() => {
    void openWorktree(root);
  }, [root, openWorktree]);

  return (
    <section className="commit-detail-panel" aria-label="Uncommitted changes">
      <SplitPane
        className="commit-detail-body"
        direction="horizontal"
        side="start"
        storageKey={LAYOUT_KEYS.historyFiles}
        defaultSize={320}
        min={200}
        max={560}
        label="Resize uncommitted file list"
      >
        <DiffFilesPanel />
        <DiffPatchPanel />
      </SplitPane>
    </section>
  );
}
