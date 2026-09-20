import { useEffect } from "react";
import { subscribeJobEvents } from "../bridge/events";
import { useRemoteStore } from "../stores/remote";

/** Conecta los eventos de fetch/pull/push con el store (OG-011). */
export function useJobEvents(): void {
  useEffect(() => {
    let disposed = false;
    let unlisteners: Array<() => void> = [];
    void subscribeJobEvents({
      onOutput: (payload) => useRemoteStore.getState().handleOutput(payload),
      onFinished: (payload) => useRemoteStore.getState().handleFinished(payload),
    })
      .then((functions) => {
        if (disposed) {
          functions.forEach((unlisten) => unlisten());
        } else {
          unlisteners = functions;
        }
      })
      .catch(() => {
        // Sin eventos la app sigue; las operaciones se ven por el watcher.
      });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);
}
