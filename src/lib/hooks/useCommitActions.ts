import { confirmDestructive } from "../bridge/dialog";
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
  revert: (commit: Commit) => Promise<void>;
  reset: (commit: Commit) => Promise<void>;
  rebase: (commit: Commit) => Promise<void>;
};

/** Actions for a commit, shared by the detail panel and the context menu. */
export function useCommitActions(): CommitActions {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const currentBranch = useRefsStore((state) => state.current);
  const openCommit = useDiffStore((state) => state.openCommit);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const cherryPick = useLogStore((state) => state.cherryPick);
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
    revert: async (commit) => {
      if (
        root &&
        (await confirmDestructive(`Create a revert commit for ${commit.hash.slice(0, 7)}?`))
      ) {
        await revert(root, commit.hash);
      }
    },
    reset: async (commit) => {
      if (
        root &&
        (await confirmDestructive(
          `Move ${currentBranch ?? "HEAD"} to ${commit.hash.slice(0, 7)}? Changes are kept in the working tree, unstaged.`,
        ))
      ) {
        await resetTo(root, commit.hash);
      }
    },
    rebase: async (commit) => {
      if (!root) {
        return;
      }
      await openRebase(root, commit.hash);
      setActiveView("rebase");
    },
  };
}
