import { describe, expect, it } from "vitest";
import { classifyRef, formatAuthor, formatCommitDate, parseTrack } from "./format";

describe("parseTrack", () => {
  it("lee ahead y behind del track de git", () => {
    expect(parseTrack("[ahead 1, behind 2]")).toEqual({ ahead: 1, behind: 2 });
    expect(parseTrack("[ahead 3]")).toEqual({ ahead: 3, behind: 0 });
    expect(parseTrack("[behind 4]")).toEqual({ ahead: 0, behind: 4 });
  });

  it("ignora estados sin contadores", () => {
    expect(parseTrack("[gone]")).toBeNull();
    expect(parseTrack("")).toBeNull();
    expect(parseTrack(null)).toBeNull();
  });
});

describe("formatCommitDate", () => {
  // Reloj fijo: sin inyectar "ahora" estos tests fallarían al cruzar medianoche.
  const now = new Date(2026, 8, 18, 22, 30);
  const at = (date: Date) => Math.floor(date.getTime() / 1000);

  it("muestra las horas de hoy como Today", () => {
    expect(formatCommitDate(at(new Date(2026, 8, 18, 9, 5)), now)).toBe("Today at 09:05");
  });

  it("muestra ayer como Yesterday aunque hayan pasado pocas horas", () => {
    // 23:50 de ayer está a 2h40 de "ahora", pero es otro día natural.
    expect(formatCommitDate(at(new Date(2026, 8, 17, 23, 50)), now)).toBe("Yesterday at 23:50");
  });

  it("usa fecha absoluta a partir de anteayer", () => {
    const texto = formatCommitDate(at(new Date(2026, 8, 16, 10, 0)), now);

    expect(texto).not.toContain("Today");
    expect(texto).not.toContain("Yesterday");
    expect(texto).toContain("16");
  });

  it("incluye el año cuando el commit es de otro año", () => {
    expect(formatCommitDate(at(new Date(2024, 0, 3, 10, 0)), now)).toContain("2024");
  });
});

describe("formatAuthor", () => {
  it("junta nombre y email", () => {
    expect(formatAuthor("Raúl López", "rldona@users.noreply.github.com")).toBe(
      "Raúl López <rldona@users.noreply.github.com>",
    );
  });

  it("omite los ángulos si no hay email", () => {
    expect(formatAuthor("Raúl López", "")).toBe("Raúl López");
  });
});

describe("classifyRef", () => {
  it("distingue HEAD, rama local, remota y tag", () => {
    expect(classifyRef("HEAD")).toEqual({ kind: "head", label: "HEAD" });
    expect(classifyRef("HEAD -> main")).toEqual({ kind: "head", label: "main" });
    expect(classifyRef("tag: v1.0.0")).toEqual({ kind: "tag", label: "v1.0.0" });
    expect(classifyRef("origin/main")).toEqual({ kind: "remote", label: "origin/main" });
    expect(classifyRef("feature")).toEqual({ kind: "branch", label: "feature" });
  });

  it("trata como remota una rama con barra", () => {
    // Limitación conocida: `%D` no marca el origen, así que una rama local
    // llamada "feat/x" se clasifica como remota.
    expect(classifyRef("feat/x").kind).toBe("remote");
  });
});
