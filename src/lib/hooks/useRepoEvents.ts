import { useEffect } from "react";
import { subscribeRepoEvents } from "../bridge/events";
import { refreshRepo } from "../refresh";
import { useStatusStore } from "../stores/status";

/** Connects watcher events to the stores (OG-010). */
export function useRepoEvents(root: string | null): void {
  useEffect(() => {
    if (!root) {
      return;
    }
    let disposed = false;
    let unlisteners: Array<() => void> = [];
    // The payload is the emitting repo's root: ignoring other repos avoids a
    // late event from the previous project refreshing the new one.
    const only = (action: () => void) => (eventRoot: string) => {
      if (eventRoot === root) {
        action();
      }
    };
    const reloadStatus = () => {
      void useStatusStore.getState().refresh(root);
    };
    void subscribeRepoEvents({
      // Ref changes can move anything (HEAD, tracking, branches), so the whole
      // repository is reloaded; index and worktree changes only touch status.
      onRefsChanged: only(() => {
        void refreshRepo(root);
      }),
      onIndexChanged: only(reloadStatus),
      onWorktreeChanged: only(reloadStatus),
      onRefreshed: only(() => {
        void refreshRepo(root);
      }),
    })
      .then((functions) => {
        if (disposed) {
          functions.forEach((unlisten) => unlisten());
        } else {
          unlisteners = functions;
        }
      })
      .catch(() => {
        // Without events, the UI keeps working with on-demand data.
      });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [root]);
}
