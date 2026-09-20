import { useEffect } from "react";
import { subscribeJobEvents } from "../bridge/events";
import { useRemoteStore } from "../stores/remote";

/** Connects fetch/pull/push events to the store (OG-011). */
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
        // Without events the app keeps going; operations show up via the watcher.
      });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);
}
