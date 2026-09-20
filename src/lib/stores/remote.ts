import { create } from "zustand";
import { cancelRemoteJob, startRemoteJob } from "../bridge/jobs";
import { formatGitError } from "../bridge/errors";
import type { JobFinishedEvent, JobKind, JobOutputEvent } from "../bridge/types";
import { describeRemoteError } from "../remote/errors";
import { describeRemoteJob } from "../remote/labels";
import { useLogStore } from "./log";
import { useRefsStore } from "./refs";
import { useRepoStore } from "./repo";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const MAX_RECENT_LINES = 200;

type RemoteState = {
  jobId: string | null;
  kind: JobKind["kind"] | null;
  /** Progress/error window title (e.g. Pulling Branch "main" From "origin"). */
  title: string | null;
  running: boolean;
  error: string | null;
  recentLines: string[];
  /** Cancel pressed before the job id is known. */
  cancelRequested: boolean;
  /** Destination to open when a clone finishes (OG-085). */
  cloneDestination: string | null;
  start: (root: string, kind: JobKind) => Promise<void>;
  cancel: () => Promise<void>;
  /** Closes the error window and clears its output. */
  dismiss: () => void;
  handleOutput: (payload: JobOutputEvent) => void;
  handleFinished: (payload: JobFinishedEvent) => void;
  reset: () => void;
};

function output(line: string): void {
  useUiStore.getState().appendOutput(line);
}

export const useRemoteStore = create<RemoteState>((set, get) => ({
  jobId: null,
  kind: null,
  title: null,
  running: false,
  error: null,
  recentLines: [],
  cancelRequested: false,
  cloneDestination: null,

  start: async (root, kind) => {
    if (get().running) {
      return;
    }
    set({
      running: true,
      error: null,
      recentLines: [],
      kind: kind.kind,
      title: describeRemoteJob(kind),
      cloneDestination: kind.kind === "clone" ? kind.destination : null,
    });
    output(`Running ${kind.kind}…`);
    try {
      const jobId = await startRemoteJob(root, kind);
      if (!get().running) {
        // The finished event arrived before the invoke response.
        return;
      }
      set({ jobId });
      if (get().cancelRequested) {
        await get().cancel();
      }
    } catch (error) {
      const message = formatGitError(error);
      set({ running: false, kind: null, error: message, cloneDestination: null });
      output(`Could not start ${kind.kind}: ${message}`);
    }
  },

  cancel: async () => {
    const { jobId, running } = get();
    if (!jobId) {
      // The invoke has not returned the id yet: it is cancelled as soon as it arrives.
      if (running) {
        set({ cancelRequested: true });
      }
      return;
    }
    set({ cancelRequested: false });
    try {
      await cancelRemoteJob(jobId);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  dismiss: () => set({ error: null, recentLines: [], title: null }),

  handleOutput: (payload) => {
    const { jobId, running } = get();
    if (!running || (jobId !== null && payload.job_id !== jobId)) {
      return;
    }
    // The job may start emitting before the invoke returns its id:
    // the first event adopts it so no output is lost.
    if (jobId === null) {
      set({ jobId: payload.job_id });
    }
    output(payload.line);
    set((state) => ({
      recentLines: [...state.recentLines, payload.line].slice(-MAX_RECENT_LINES),
    }));
  },

  handleFinished: (payload) => {
    const { jobId, running } = get();
    if (!running || (jobId !== null && payload.job_id !== jobId)) {
      return;
    }
    const { kind, recentLines, cloneDestination } = get();
    set({
      running: false,
      jobId: null,
      kind: null,
      cancelRequested: false,
      cloneDestination: null,
    });

    if (payload.success) {
      set({ title: null });
      output(`${kind ?? "job"} done`);
    } else if (payload.cancelled) {
      set({ title: null });
      output(`${kind ?? "job"} cancelled`);
    } else {
      // The title is kept: it heads the error window until it is closed.
      const hint = describeRemoteError(recentLines);
      const message = hint ?? `${kind ?? "job"} failed (exit code ${payload.exit_code})`;
      set({ error: message });
      output(`${kind ?? "job"} failed: ${message}`);
    }

    // The watcher also reacts, but we refresh now so as not to depend on it.
    const log = useLogStore.getState();
    const refs = useRefsStore.getState();
    if (refs.root) {
      void refs.refresh(refs.root);
    }
    if (log.root) {
      void log.reload(log.root);
      void useStatusStore.getState().refresh(log.root);
    }

    // A finished clone opens the new repository (OG-085).
    if (payload.success && cloneDestination) {
      void useRepoStore.getState().open(cloneDestination);
    }
  },

  reset: () =>
    set({
      jobId: null,
      kind: null,
      title: null,
      running: false,
      error: null,
      recentLines: [],
      cancelRequested: false,
      cloneDestination: null,
    }),
}));
