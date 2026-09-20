/**
 * Utilidades para presentar el parche de git. Git es la fuente de verdad:
 * aquí solo se separa el parche en sus dos versiones para el modo lado a lado.
 */

export type SplitPatch = {
  original: string;
  modified: string;
  hunks: number;
};

/** Altura de fila del visor de parches (staging por hunks/líneas). */
export const PATCH_ROW_HEIGHT = 20;

export type PatchLineType = "hunk" | "add" | "del" | "context" | "meta";

export type ClassifiedPatchLine = {
  /** Índice global de la línea dentro del parche (lo que espera el backend). */
  index: number;
  text: string;
  type: PatchLineType;
  hunk: number | null;
};

/** Clasifica las líneas del parche para pintarlas y seleccionarlas. */
export function classifyPatchLines(patch: string): ClassifiedPatchLine[] {
  const raw = patch.split("\n");
  if (raw.length > 0 && raw[raw.length - 1] === "") {
    raw.pop();
  }
  let hunk = -1;
  let inHunk = false;
  return raw.map((text, index) => {
    if (text.startsWith("@@")) {
      hunk += 1;
      inHunk = true;
      return { index, text, type: "hunk", hunk };
    }
    if (!inHunk) {
      return { index, text, type: "meta", hunk: null };
    }
    if (text.startsWith("+") && !text.startsWith("+++")) {
      return { index, text, type: "add", hunk };
    }
    if (text.startsWith("-") && !text.startsWith("---")) {
      return { index, text, type: "del", hunk };
    }
    if (text.startsWith("\\")) {
      return { index, text, type: "meta", hunk };
    }
    return { index, text, type: "context", hunk };
  });
}

export function isBinaryPatch(patch: string): boolean {
  return patch
    .split("\n")
    .some((line) => line.startsWith("Binary files ") || line.startsWith("GIT binary patch"));
}

/**
 * Divide un parche unificado en el texto original y el modificado.
 * Devuelve `null` si no hay hunks (binario, solo modo de fichero o vacío).
 */
export function splitPatch(patch: string): SplitPatch | null {
  if (patch.trim() === "" || isBinaryPatch(patch)) {
    return null;
  }
  const original: string[] = [];
  const modified: string[] = [];
  let hunks = 0;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      hunks += 1;
      continue;
    }
    if (hunks === 0) {
      // Cabeceras (`diff --git`, `index`, `---`, `+++`, modos, rename...).
      continue;
    }
    if (line.startsWith("\\ No newline")) {
      continue;
    }
    if (line.startsWith("+")) {
      modified.push(line.slice(1));
      continue;
    }
    if (line.startsWith("-")) {
      original.push(line.slice(1));
      continue;
    }
    if (line.startsWith(" ")) {
      const text = line.slice(1);
      original.push(text);
      modified.push(text);
    }
  }

  if (hunks === 0) {
    return null;
  }
  return { original: original.join("\n"), modified: modified.join("\n"), hunks };
}
