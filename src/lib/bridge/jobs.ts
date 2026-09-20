import { invoke } from "@tauri-apps/api/core";
import type { JobKind } from "./types";

export function startRemoteJob(path: string, kind: JobKind): Promise<string> {
  return invoke<string>("start_remote_job", { path, kind });
}

/** Marca el job para cancelar; el proceso muere en menos de 100 ms. */
export function cancelRemoteJob(jobId: string): Promise<boolean> {
  return invoke<boolean>("cancel_remote_job", { jobId });
}
