import { confirmDestructive, pickDirectory } from "../bridge/dialog";
import { formatGitError } from "../bridge/errors";
import type { ResetMode } from "../bridge/history";
import { formatPatch } from "../bridge/patch";
import type { Commit } from "../bridge/types";
import { useDiffStore } from "../stores/diff";
import { useLogStore } from "../stores/log";
import { useRebaseStore } from "../stores/rebase";
import { useRefsStore } from "../stores/refs";
import { useRepoStore } from "../stores/repo";
import { useUiStore } from "../stores/ui";

export type CommitActions = {
  showDiff: (commit: Commit) => Promise<void>;
  cherryPick: (commit: Commit) => Promise<void>;
  cherryPickRange: (revs: string[], recordSource?: boolean) => Promise<void>;
  revert: (commit: Commit, mainline?: number) => Promise<void>;
  reset: (commit: Commit, mode: ResetMode) => Promise<void>;
  rebase: (commit: Commit) => Promise<void>;
  createPatch: (commit: Commit) => Promise<void>;
  createPatchesToHead: (commit: Commit) => Promise<void>;
};

async function exportPatches(root: string | null, spec: string, single: boolean): Promise<void> {
  if (!root) {
    return;
  }
  const outDir = await pickDirectory("Choose a folder for the patch");
  if (outDir === null) {
    return;
  }
  try {
    const files = await formatPatch(root, spec, single, outDir);
    useUiStore
      .getState()
      .appendOutput(files.length === 0 ? "No patches created" : `Patch(es): ${files.join(", ")}`);
  } catch (error) {
    useUiStore.getState().appendOutput(`Could not create the patch: ${formatGitError(error)}`);
  }
}

/** Actions for a commit, shared by the detail panel and the context menu. */
export function useCommitActions(): CommitActions {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const currentBranch = useRefsStore((state) => state.current);
  const openCommit = useDiffStore((state) => state.openCommit);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const cherryPick = useLogStore((state) => state.cherryPick);
  const cherryPickRangeStore = useLogStore((state) => state.cherryPickRange);
  const revert = useLogStore((state) => state.revert);
  const resetTo = useLogStore((state) => state.resetTo);
  const openRebase = useRebaseStore((state) => state.open);

  return {
    showDiff: async (commit) => {
      if (!root) {
        return;
      }
      await openCommit(root, commit.hash);
      setActiveView("diff");
    },
    cherryPick: async (commit) => {
      if (
        root &&
        (await confirmDestructive(
          `Cherry-pick ${commit.hash.slice(0, 7)} onto ${currentBranch ?? "HEAD"}?`,
        ))
      ) {
        await cherryPick(root, commit.hash);
      }
    },
    cherryPickRange: async (revs, recordSource = false) => {
      if (
        root &&
        revs.length > 0 &&
        (await confirmDestructive(
          `Cherry-pick ${revs.length} commit(s) onto ${currentBranch ?? "HEAD"}?`,
        ))
      ) {
        await cherryPickRangeStore(root, revs, recordSource);
      }
    },
    revert: async (commit, mainline) => {
      if (!root) {
        return;
      }
      const where = mainline === undefined ? "" : ` (mainline ${mainline})`;
      if (
        await confirmDestructive(`Create a revert commit for ${commit.hash.slice(0, 7)}${where}?`)
      ) {
        await revert(root, commit.hash, mainline);
      }
    },
    reset: async (commit, mode) => {
      if (!root) {
        return;
      }
      const short = commit.hash.slice(0, 7);
      const message =
        mode === "hard"
          ? `Hard reset ${currentBranch ?? "HEAD"} to ${short}? Uncommitted changes are DISCARDED.`
          : mode === "soft"
            ? `Soft reset ${currentBranch ?? "HEAD"} to ${short}? Changes stay staged.`
            : `Move ${currentBranch ?? "HEAD"} to ${short}? Changes are kept in the working tree, unstaged.`;
      if (await confirmDestructive(message)) {
        await resetTo(root, commit.hash, mode);
      }
    },
    rebase: async (commit) => {
      if (!root) {
        return;
      }
      await openRebase(root, commit.hash);
      setActiveView("rebase");
    },
    createPatch: (commit) => exportPatches(root, commit.hash, true),
    createPatchesToHead: (commit) => exportPatches(root, commit.hash, false),
  };
}
