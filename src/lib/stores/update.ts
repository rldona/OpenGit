import { create } from "zustand";
import { appVersion } from "../bridge/app";
import { cacheFresh, fetchLatestTag, isNewer, openReleasesPage, stampCheck } from "../updates";

export type UpdateStatus = "idle" | "checking" | "available" | "up-to-date" | "error";

type UpdateState = {
  status: UpdateStatus;
  version: string | null;
  /** Silent unless `manual`: only `available` surfaces automatically. */
  check: (options?: { manual?: boolean }) => Promise<void>;
  openDownload: () => Promise<void>;
  dismiss: () => void;
  reset: () => void;
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,

  check: async (options) => {
    const manual = options?.manual === true;
    if (get().status === "checking") {
      return;
    }
    if (!manual && cacheFresh()) {
      return;
    }
    set({ status: "checking", version: null });
    try {
      const [current, tag] = await Promise.all([appVersion(), fetchLatestTag()]);
      stampCheck();
      if (tag === null) {
        // Offline or API failure: silent on automatic checks.
        set({ status: manual ? "error" : "idle" });
        return;
      }
      if (isNewer(current, tag)) {
        set({ status: "available", version: tag });
      } else {
        set({ status: manual ? "up-to-date" : "idle", version: manual ? current : null });
      }
    } catch {
      set({ status: manual ? "error" : "idle" });
    }
  },

  openDownload: async () => {
    await openReleasesPage();
  },

  dismiss: () => set({ status: "idle", version: null }),

  reset: () => set({ status: "idle", version: null }),
}));
