import { beforeEach, describe, expect, it } from "vitest";
import {
  COLUMN_DEFAULTS,
  COLUMN_MAX,
  COLUMN_MIN,
  loadColumnWidths,
  saveColumnWidths,
  widthAfterDrag,
} from "./columns";

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
