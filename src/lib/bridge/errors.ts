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

/** Convierte el error serializado de Rust en un mensaje para la UI. */
export function formatGitError(error: unknown): string {
  const payload = asPayload(error);
  if (!payload) {
    return String(error);
  }
  switch (payload.kind) {
    case "not_found":
      return `No se encontró el binario de git: ${text(payload.binary)}`;
    case "spawn":
      return `No se pudo ejecutar git: ${text(payload.message)}`;
    case "command_failed": {
      const stderr = text(payload.stderr).trim();
      const stdout = text(payload.stdout).trim();
      const detail = stderr || stdout;
      return `git falló con código ${text(payload.exit_code)}${detail ? `: ${detail}` : ""}`;
    }
    case "timeout":
      return "git no respondió a tiempo";
    case "cancelled":
      return "Operación cancelada";
    case "invalid_output":
      return `Salida inesperada de git: ${text(payload.message)}`;
    case "path_not_found":
      return "La carpeta no existe";
    case "not_a_repository":
      return "La carpeta seleccionada no es un repositorio git";
    case "not_a_work_tree":
      return "Los repositorios bare no están soportados todavía";
    case "invalid_head":
      return "El repositorio tiene un HEAD inválido";
    case "git_too_old":
      return `Se requiere git ${text(payload.minimum)} o superior (instalado ${text(payload.found)})`;
    case "store":
      return `No se pudo guardar el estado de la app: ${text(payload.message)}`;
    default:
      return `Error de git: ${JSON.stringify(payload)}`;
  }
}
