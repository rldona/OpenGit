import { useEffect } from "react";
import { subscribeRepoEvents } from "../bridge/events";
import { useLogStore } from "../stores/log";
import { useRefsStore } from "../stores/refs";
import { useStashStore } from "../stores/stash";
import { useStatusStore } from "../stores/status";

/** Conecta los eventos del watcher con los stores (OG-010). */
export function useRepoEvents(root: string | null): void {
  useEffect(() => {
    if (!root) {
      return;
    }
    let disposed = false;
    let unlisteners: Array<() => void> = [];
    const reloadLog = () => {
      void useLogStore.getState().reload(root);
    };
    const reloadStatus = () => {
      void useStatusStore.getState().refresh(root);
    };
    const reloadRefs = () => {
      void useRefsStore.getState().refresh(root);
    };
    const reloadStashes = () => {
      void useStashStore.getState().refresh(root);
    };
    void subscribeRepoEvents({
      onRefsChanged: () => {
        reloadLog();
        reloadRefs();
        reloadStatus();
        reloadStashes();
      },
      onIndexChanged: reloadStatus,
      onWorktreeChanged: reloadStatus,
      onRefreshed: () => {
        reloadLog();
        reloadRefs();
        reloadStatus();
        reloadStashes();
      },
    })
      .then((functions) => {
        if (disposed) {
          functions.forEach((unlisten) => unlisten());
        } else {
          unlisteners = functions;
        }
      })
      .catch(() => {
        // Sin eventos, la UI sigue funcionando con datos bajo demanda.
      });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [root]);
}
