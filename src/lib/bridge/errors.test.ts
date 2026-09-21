import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "../stores/locale";
import { formatGitError } from "./errors";

describe("formatGitError", () => {
  beforeEach(() => {
    useLocaleStore.setState({ preference: null, locale: "en" });
  });

  it("maps a typed error to a message by kind", () => {
    expect(formatGitError({ kind: "not_a_repository" })).toBe(
      "The selected folder is not a git repository",
    );
    expect(
      formatGitError({ kind: "command_failed", exit_code: 128, stdout: "", stderr: "boom\n" }),
    ).toBe("git failed with code 128: boom");
  });

  it("translates the mapped message with the active locale", () => {
    useLocaleStore.setState({ preference: "es", locale: "es" });
    expect(formatGitError({ kind: "not_a_repository" })).toBe(
      "La carpeta seleccionada no es un repositorio git",
    );
  });

  it("keeps non-typed errors as-is", () => {
    expect(formatGitError(new Error("boom"))).toContain("boom");
  });
});
