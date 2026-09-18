import { invoke } from "@tauri-apps/api/core";
import type { PlanCommit, TodoItem } from "./types";

export function rebasePlan(path: string, base: string): Promise<PlanCommit[]> {
  return invoke<PlanCommit[]>("rebase_plan", { path, base });
}

export function interactiveRebase(
  path: string,
  base: string,
  todos: TodoItem[],
  rewordMessage: string | null,
): Promise<void> {
  return invoke<void>("interactive_rebase", { path, base, todos, rewordMessage });
}
