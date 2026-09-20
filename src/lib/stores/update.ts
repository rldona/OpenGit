import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";
import { cacheFresh, stampCheck } from "../updates";

export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "up-to-date" | "error";

type UpdateState = {
  status: UpdateStatus;
  version: string | null;
  /** 0..1 while downloading; null when the total size is unknown. */
  progress: number | null;
  /** Human-readable failure reason for the error state (debugging aid). */
  detail: string | null;
  /** Whether the flow was started from the menu (surfaces transient states). */
  manual: boolean;
  /** Silent unless `manual`: automatic checks only surface a ready update. */
  check: (options?: { manual?: boolean }) => Promise<void>;
  restart: () => Promise<void>;
  dismiss: () => void;
  reset: () => void;
};

/** Downloaded update waiting for the user to restart (module scope, not state). */
let pending: Update | null = null;
let busy = false;

function failureDetail(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  progress: null,
  detail: null,
  manual: false,

  check: async (options) => {
    const manual = options?.manual === true;

    // A downloaded update is already waiting; reopen the restart prompt.
    if (pending !== null) {
      set({ status: "ready", version: pending.version, progress: 1, manual });
      return;
    }
    // While a download runs, a manual check just reveals its progress.
    if (busy) {
      if (manual && get().version !== null) {
        set({ status: "downloading", manual: true });
      }
      return;
    }
    if (!manual && cacheFresh()) {
      return;
    }

    busy = true;
    set({
      status: manual ? "checking" : "idle",
      version: null,
      progress: null,
      detail: null,
      manual,
    });

    let update: Update | null;
    try {
      update = await check();
    } catch (error) {
      stampCheck();
      busy = false;
      // Automatic checks stay silent; manual ones report the reason.
      set({ status: manual ? "error" : "idle", detail: failureDetail(error) });
      return;
    }
    stampCheck();

    if (update === null) {
      busy = false;
      set({ status: manual ? "up-to-date" : "idle" });
      return;
    }

    set({
      version: update.version,
      status: manual ? "downloading" : "idle",
      progress: null,
      detail: null,
    });

    let total: number | null = null;
    let received = 0;
    try {
      await update.download((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? null;
          set({ progress: total === null ? null : 0 });
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total !== null && total > 0) {
            set({ progress: Math.min(received / total, 1) });
          }
        }
      });
    } catch (error) {
      busy = false;
      set({
        status: manual ? "error" : "idle",
        progress: null,
        detail: manual ? failureDetail(error) : null,
      });
      return;
    }

    busy = false;
    pending = update;
    set({ status: "ready", progress: 1 });
  },

  restart: async () => {
    const update = pending;
    if (update === null) {
      return;
    }
    try {
      await update.install();
    } catch (error) {
      set({ status: "error", detail: failureDetail(error) });
      return;
    }
    // On Windows the installer exits the app inside `install`; on macOS and
    // Linux the process survives and has to be relaunched by hand.
    await relaunch();
  },

  dismiss: () =>
    set({ status: "idle", version: null, progress: null, detail: null, manual: false }),

  reset: () => {
    pending = null;
    busy = false;
    set({ status: "idle", version: null, progress: null, detail: null, manual: false });
  },
}));
