import { describe, expect, it } from "vitest";
import { parseLfsPointerPatch } from "./lfs";

const OID = "a".repeat(64);

describe("parseLfsPointerPatch", () => {
  it("detecta un puntero en un parche unificado", () => {
    const patch = [
      "diff --git a/model.bin b/model.bin",
      "index 1111111..2222222 100644",
      "--- a/model.bin",
      "+++ b/model.bin",
      "@@ -1,3 +1,3 @@",
      "+version https://git-lfs.github.com/spec/v1",
      `+oid sha256:${OID}`,
      "+size 4096",
    ].join("\n");

    expect(parseLfsPointerPatch(patch)).toEqual({ oid: OID, size: 4096 });
  });

  it("detecta un puntero en un parche side-by-side", () => {
    const patch = [
      "version https://git-lfs.github.com/spec/v1",
      `oid sha256:${OID}`,
      "size 12",
    ].join("\n");

    expect(parseLfsPointerPatch(patch)).toEqual({ oid: OID, size: 12 });
  });

  it("acepta espacios finales y contexto", () => {
    const patch = [
      " version https://git-lfs.github.com/spec/v1 ",
      ` oid sha256:${OID}`,
      " size 7",
    ].join("\n");

    expect(parseLfsPointerPatch(patch)).toEqual({ oid: OID, size: 7 });
  });

  it("no marca diffs normales", () => {
    expect(parseLfsPointerPatch("@@ -1 +1 @@\n-viejo\n+nuevo\n")).toBeNull();
    expect(parseLfsPointerPatch("")).toBeNull();
  });

  it("rechaza punteros incompletos o inválidos", () => {
    const version = "version https://git-lfs.github.com/spec/v1";
    expect(parseLfsPointerPatch(`${version}\n+size 10\n`)).toBeNull();
    expect(parseLfsPointerPatch(`${version}\n+oid sha256:no-hex\n+size 10\n`)).toBeNull();
    expect(parseLfsPointerPatch(`${version}\n+oid sha256:${OID}\n+size grande\n`)).toBeNull();
  });
});
