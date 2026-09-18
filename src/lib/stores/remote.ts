import { create } from "zustand";
import { cancelRemoteJob, startRemoteJob } from "../bridge/jobs";
import { formatGitError } from "../bridge/errors";
import type { JobFinishedEvent, JobKind, JobOutputEvent } from "../bridge/types";
import { describeRemoteError } from "../remote/errors";
import { useLogStore } from "./log";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const MAX_RECENT_LINES = 200;

type RemoteState = {
  jobId: string | null;
  kind: JobKind["kind"] | null;
  running: boolean;
  error: string | null;
  recentLines: string[];
  start: (root: string, kind: JobKind) => Promise<void>;
  cancel: () => Promise<void>;
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
  running: false,
  error: null,
  recentLines: [],

  start: async (root, kind) => {
    if (get().running) {
      return;
    }
    set({ running: true, error: null, recentLines: [], kind: kind.kind });
    output(`Running ${kind.kind}…`);
    try {
      const jobId = await startRemoteJob(root, kind);
      set({ jobId });
    } catch (error) {
      const message = formatGitError(error);
      set({ running: false, kind: null, error: message });
      output(`Could not start ${kind.kind}: ${message}`);
    }
  },

  cancel: async () => {
    const { jobId } = get();
    if (!jobId) {
      return;
    }
    try {
      await cancelRemoteJob(jobId);
    } catch (error) {
      set({ error: formatGitError(error) });
    }
  },

  handleOutput: (payload) => {
    if (payload.job_id !== get().jobId) {
      return;
    }
    output(payload.line);
    set((state) => ({
      recentLines: [...state.recentLines, payload.line].slice(-MAX_RECENT_LINES),
    }));
  },

  handleFinished: (payload) => {
    const { jobId, kind, recentLines } = get();
    if (payload.job_id !== jobId) {
      return;
    }
    set({ running: false, jobId: null, kind: null });

    if (payload.success) {
      output(`${kind ?? "job"} done`);
    } else if (payload.cancelled) {
      output(`${kind ?? "job"} cancelled`);
    } else {
      const hint = describeRemoteError(recentLines);
      const message = hint ?? `${kind ?? "job"} failed (exit code ${payload.exit_code})`;
      set({ error: message });
      output(`${kind ?? "job"} failed: ${message}`);
    }

    // El watcher también reacciona, pero refrescamos ya para no depender de él.
    const log = useLogStore.getState();
    const refs = useRefsStore.getState();
    if (refs.root) {
      void refs.refresh(refs.root);
    }
    if (log.root) {
      void log.reload(log.root);
      void useStatusStore.getState().refresh(log.root);
    }
  },

  reset: () =>
    set({
      jobId: null,
      kind: null,
      running: false,
      error: null,
      recentLines: [],
    }),
}));
