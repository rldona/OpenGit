import { beforeEach, describe, expect, it } from "vitest";
import type { Commit } from "./bridge/types";
import {
  COLUMN_DEFAULTS,
  COLUMN_MAX,
  COLUMN_MIN,
  loadColumnWidths,
  nextSort,
  saveColumnWidths,
  sortCommits,
  widthAfterDrag,
} from "./columns";

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "aaaa0001",
    parents: [],
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 100,
    refs: [],
    subject: "uno",
    body: "",
    ...overrides,
  };
}

describe("widthAfterDrag", () => {
  it("ensancha al arrastrar hacia la izquierda", () => {
    // Las columnas fijas están a la derecha: arrastrar su borde izquierdo
    // hacia la izquierda las hace más anchas.
    expect(widthAfterDrag(100, -30)).toBe(130);
    expect(widthAfterDrag(100, 30)).toBe(70);
  });

  it("respeta el mínimo y el máximo", () => {
    expect(widthAfterDrag(COLUMN_MIN, 500)).toBe(COLUMN_MIN);
    expect(widthAfterDrag(COLUMN_MAX, -500)).toBe(COLUMN_MAX);
  });
});

describe("sortCommits", () => {
  const commits = [
    commit({ hash: "cccc", subject: "c", author_time: 100, author_name: "Zoe" }),
    commit({ hash: "aaaa", subject: "a", author_time: 300, author_name: "Ana" }),
    commit({ hash: "bbbb", subject: "b", author_time: 200, author_name: "Luis" }),
  ];

  it("sin orden devuelve el topológico tal cual", () => {
    expect(sortCommits(commits, null)).toBe(commits);
  });

  it("ordena por descripción, hash, autor y fecha en ambos sentidos", () => {
    expect(
      sortCommits(commits, { column: "description", direction: "asc" }).map((c) => c.subject),
    ).toEqual(["a", "b", "c"]);
    expect(sortCommits(commits, { column: "hash", direction: "desc" }).map((c) => c.hash)).toEqual([
      "cccc",
      "bbbb",
      "aaaa",
    ]);
    expect(
      sortCommits(commits, { column: "author", direction: "asc" }).map((c) => c.author_name),
    ).toEqual(["Ana", "Luis", "Zoe"]);
    expect(
      sortCommits(commits, { column: "date", direction: "desc" }).map((c) => c.author_time),
    ).toEqual([300, 200, 100]);
  });
});

describe("nextSort", () => {
  it("cicla ascendente → descendente → topológico", () => {
    const asc = nextSort(null, "description");
    expect(asc).toEqual({ column: "description", direction: "asc" });

    const desc = nextSort(asc, "description");
    expect(desc).toEqual({ column: "description", direction: "desc" });

    expect(nextSort(desc, "description")).toBeNull();
  });

  it("cambiar de columna empieza ascendente", () => {
    expect(nextSort({ column: "date", direction: "desc" }, "hash")).toEqual({
      column: "hash",
      direction: "asc",
    });
  });
});

describe("loadColumnWidths", () => {
  beforeEach(() => localStorage.clear());

  it("devuelve los valores por defecto sin nada guardado", () => {
    expect(loadColumnWidths()).toEqual(COLUMN_DEFAULTS);
  });

  it("recupera lo guardado", () => {
    saveColumnWidths({ hash: 90, author: 200, date: 130 });

    expect(loadColumnWidths()).toEqual({ hash: 90, author: 200, date: 130 });
  });

  it("sanea valores corruptos en vez de romper la tabla", () => {
    localStorage.setItem(
      "opengit.columns.commit-table",
      JSON.stringify({ hash: 9999, author: "ancho", date: -40 }),
    );

    const widths = loadColumnWidths();

    expect(widths.hash).toBe(COLUMN_MAX);
    expect(widths.author).toBe(COLUMN_DEFAULTS.author);
    expect(widths.date).toBe(COLUMN_MIN);
  });

  it("aguanta un JSON inválido", () => {
    localStorage.setItem("opengit.columns.commit-table", "{no es json");

    expect(loadColumnWidths()).toEqual(COLUMN_DEFAULTS);
  });
});
