import { create } from "zustand";
import { appVersion } from "../bridge/app";
import { cacheFresh, fetchLatestTag, isNewer, openReleasesPage, stampCheck } from "../updates";

export type UpdateStatus = "idle" | "checking" | "available" | "up-to-date" | "error";

type UpdateState = {
  status: UpdateStatus;
  version: string | null;
  /** Human-readable failure reason for the error state (debugging aid). */
  detail: string | null;
  /** Silent unless `manual`: only `available` surfaces automatically. */
  check: (options?: { manual?: boolean }) => Promise<void>;
  openDownload: () => Promise<void>;
  dismiss: () => void;
  reset: () => void;
};

function failureDetail(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "request timed out";
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  detail: null,

  check: async (options) => {
    const manual = options?.manual === true;
    if (get().status === "checking") {
      return;
    }
    if (!manual && cacheFresh()) {
      return;
    }
    set({ status: "checking", version: null, detail: null });
    try {
      const [current, tag] = await Promise.all([appVersion(), fetchLatestTag()]);
      stampCheck();
      if (isNewer(current, tag)) {
        set({ status: "available", version: tag });
      } else {
        set({ status: manual ? "up-to-date" : "idle", version: manual ? current : null });
      }
    } catch (error) {
      stampCheck();
      // Automatic checks stay silent; manual ones report the reason.
      set({ status: manual ? "error" : "idle", detail: failureDetail(error) });
    }
  },

  openDownload: async () => {
    await openReleasesPage();
  },

  dismiss: () => set({ status: "idle", version: null, detail: null }),

  reset: () => set({ status: "idle", version: null, detail: null }),
}));
