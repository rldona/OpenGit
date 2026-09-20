/**
 * Utilidades para presentar el parche de git. Git es la fuente de verdad:
 * aquí solo se separa el parche en sus dos versiones para el modo lado a lado.
 */

export type SplitPatch = {
  original: string;
  modified: string;
  hunks: number;
};

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
