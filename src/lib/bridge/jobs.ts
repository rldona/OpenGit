import { invoke } from "@tauri-apps/api/core";
import type { JobKind } from "./types";

export function startRemoteJob(path: string, kind: JobKind): Promise<string> {
  return invoke<string>("start_remote_job", { path, kind });
}

/** Marks the job to cancel it; the process dies in under 100 ms. */
export function cancelRemoteJob(jobId: string): Promise<boolean> {
  return invoke<boolean>("cancel_remote_job", { jobId });
}
