export type LfsPointer = {
  oid: string;
  size: number;
};

const POINTER_VERSION = "version https://git-lfs.github.com/spec/v1";

function stripPatchPrefix(line: string): string {
  return line.trimEnd().replace(/^[+\- ]/, "");
}

/**
 * Detecta un puntero LFS en un parche (unificado o side-by-side) a partir de
 * sus líneas `version`, `oid sha256:` y `size`.
 */
export function parseLfsPointerPatch(patch: string): LfsPointer | null {
  const lines = patch.split("\n").map(stripPatchPrefix);
  const start = lines.indexOf(POINTER_VERSION);
  if (start === -1) {
    return null;
  }
  const tail = lines.slice(start);
  const oidLine = tail.find((line) => line.startsWith("oid sha256:"));
  const sizeLine = tail.find((line) => line.startsWith("size "));
  if (!oidLine || !sizeLine) {
    return null;
  }
  const oid = oidLine.slice("oid sha256:".length).trim();
  const size = Number.parseInt(sizeLine.slice("size ".length).trim(), 10);
  if (!/^[0-9a-f]{64}$/i.test(oid) || !Number.isSafeInteger(size) || size < 0) {
    return null;
  }
  return { oid, size };
}
