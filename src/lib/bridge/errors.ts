import { t } from "../i18n";
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
      return t("errors.notFound", { binary: text(payload.binary) });
    case "spawn":
      return t("errors.spawn", { message: text(payload.message) });
    case "command_failed": {
      const stderr = text(payload.stderr).trim();
      const stdout = text(payload.stdout).trim();
      const detail = stderr || stdout;
      return detail
        ? t("errors.commandFailedDetail", { code: text(payload.exit_code), detail })
        : t("errors.commandFailed", { code: text(payload.exit_code) });
    }
    case "timeout":
      return t("errors.timeout");
    case "cancelled":
      return t("errors.cancelled");
    case "invalid_output":
      return t("errors.invalidOutput", { message: text(payload.message) });
    case "path_not_found":
      return t("errors.pathNotFound");
    case "not_a_repository":
      return t("errors.notARepository");
    case "not_a_work_tree":
      return t("errors.notAWorkTree");
    case "invalid_head":
      return t("errors.invalidHead");
    case "git_too_old":
      return t("errors.gitTooOld", {
        minimum: text(payload.minimum),
        found: text(payload.found),
      });
    case "store":
      return t("errors.store", { message: text(payload.message) });
    default:
      return t("errors.generic", { detail: JSON.stringify(payload) });
  }
}
