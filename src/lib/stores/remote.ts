import { create } from "zustand";
import { cancelRemoteJob, startRemoteJob } from "../bridge/jobs";
import { formatGitError } from "../bridge/errors";
import type { JobFinishedEvent, JobKind, JobOutputEvent } from "../bridge/types";
import { describeRemoteError } from "../remote/errors";
import { describeRemoteJob } from "../remote/labels";
import { useLogStore } from "./log";
import { useRefsStore } from "./refs";
import { useStatusStore } from "./status";
import { useUiStore } from "./ui";

const MAX_RECENT_LINES = 200;

type RemoteState = {
  jobId: string | null;
  kind: JobKind["kind"] | null;
  /** Título de la ventana de progreso/error (p. ej. Pulling Branch "main" From "origin"). */
  title: string | null;
  running: boolean;
  error: string | null;
  recentLines: string[];
  /** Cancel pulsado antes de conocer el id del job. */
  cancelRequested: boolean;
  start: (root: string, kind: JobKind) => Promise<void>;
  cancel: () => Promise<void>;
  /** Cierra la ventana de error y limpia su salida. */
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
    });
    output(`Running ${kind.kind}…`);
    try {
      const jobId = await startRemoteJob(root, kind);
      if (!get().running) {
        // El evento de fin llegó antes que la respuesta del invoke.
        return;
      }
      set({ jobId });
      if (get().cancelRequested) {
        await get().cancel();
      }
    } catch (error) {
      const message = formatGitError(error);
      set({ running: false, kind: null, error: message });
      output(`Could not start ${kind.kind}: ${message}`);
    }
  },

  cancel: async () => {
    const { jobId, running } = get();
    if (!jobId) {
      // El invoke aún no ha devuelto el id: se cancela en cuanto llegue.
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
    // El job puede empezar a emitir antes de que el invoke devuelva su id:
    // el primer evento lo adopta para no perder salida.
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
    const { kind, recentLines } = get();
    set({ running: false, jobId: null, kind: null, cancelRequested: false });

    if (payload.success) {
      set({ title: null });
      output(`${kind ?? "job"} done`);
    } else if (payload.cancelled) {
      set({ title: null });
      output(`${kind ?? "job"} cancelled`);
    } else {
      // El título se conserva: encabeza la ventana de error hasta que se cierre.
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
      title: null,
      running: false,
      error: null,
      recentLines: [],
      cancelRequested: false,
    }),
}));
