import type { GitErrorPayload } from "./types";

function asPayload(error: unknown): GitErrorPayload | null {
  if (typeof error === "object" && error !== null && "kind" in error) {
    return error as GitErrorPayload;
  }
  return null;
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  return JSON.stringify(value);
}

/** Turns the serialized Rust error into a message for the UI. */
export function formatGitError(error: unknown): string {
  const payload = asPayload(error);
  if (!payload) {
    return String(error);
  }
  switch (payload.kind) {
    case "not_found":
      return `Git binary not found: ${text(payload.binary)}`;
    case "spawn":
      return `Could not run git: ${text(payload.message)}`;
    case "command_failed": {
      const stderr = text(payload.stderr).trim();
      const stdout = text(payload.stdout).trim();
      const detail = stderr || stdout;
      return `git failed with code ${text(payload.exit_code)}${detail ? `: ${detail}` : ""}`;
    }
    case "timeout":
      return "git timed out";
    case "cancelled":
      return "Operation cancelled";
    case "invalid_output":
      return `Unexpected git output: ${text(payload.message)}`;
    case "path_not_found":
      return "The folder does not exist";
    case "not_a_repository":
      return "The selected folder is not a git repository";
    case "not_a_work_tree":
      return "Bare repositories are not supported yet";
    case "invalid_head":
      return "The repository has an invalid HEAD";
    case "git_too_old":
      return `git ${text(payload.minimum)} or newer is required (found ${text(payload.found)})`;
    case "store":
      return `Could not save app state: ${text(payload.message)}`;
    default:
      return `Git error: ${JSON.stringify(payload)}`;
  }
}
