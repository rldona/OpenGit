import { useEffect } from "react";
import { useI18n } from "../lib/i18n";
import { LAYOUT_KEYS } from "../lib/layout";
import { useDiffStore } from "../lib/stores/diff";
import { DiffFilesPanel } from "./DiffFilesPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { SplitPane } from "./SplitPane";

/** Bottom panel of the "Uncommitted changes" row: files and working tree patch. */
export function WorktreeDetailPanel({ root }: { root: string }) {
  const { t } = useI18n();
  const openWorktree = useDiffStore((state) => state.openWorktree);

  useEffect(() => {
    void openWorktree(root);
  }, [root, openWorktree]);

  return (
    <section className="commit-detail-panel" aria-label={t("worktree.aria")}>
      <SplitPane
        className="commit-detail-body"
        direction="horizontal"
        side="start"
        storageKey={LAYOUT_KEYS.historyFiles}
        defaultSize={470}
        min={200}
        max={560}
        label={t("worktree.resizeFiles")}
      >
        <DiffFilesPanel />
        <DiffPatchPanel />
      </SplitPane>
    </section>
  );
}
