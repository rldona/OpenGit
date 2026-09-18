import { describe, expect, it } from "vitest";
import { colorForKey, layoutPage, type GraphInput } from "./layout";

function commit(hash: string, parents: string[] = [], refs: string[] = []): GraphInput {
  return { hash, parents, refs };
}

describe("layoutPage", () => {
  it("pinta una historia lineal en una sola lane", () => {
    const { rows, lanes } = layoutPage([commit("c", ["b"]), commit("b", ["a"]), commit("a")]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(new Set(rows.map((row) => row.laneId)).size).toBe(1);
    expect(rows[0].edges).toEqual([{ kind: "parent", from: 0, to: 0, laneId: rows[0].laneId }]);
    expect(rows[2].edges).toHaveLength(0);
    expect(lanes).toHaveLength(0);
  });

  it("asigna lanes y colores estables por rama en un merge", () => {
    const history = [
      commit("m", ["a", "f"], ["HEAD -> main"]),
      commit("f", ["a"], ["feature"]),
      commit("a"),
    ];

    const { rows, colors, lanes } = layoutPage(history);

    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(1);

    const mergeEdge = rows[0].edges.find((edge) => edge.kind === "parent" && edge.to === 1);
    expect(mergeEdge).toBeDefined();
    expect(colors[rows[0].laneId]).toBe(colorForKey("main"));
    expect(colors[mergeEdge!.laneId]).toBe(colorForKey("feature"));

    const converge = rows[2].edges.find((edge) => edge.kind === "converge");
    expect(converge).toEqual({ kind: "converge", from: 1, to: 0, laneId: mergeEdge!.laneId });
    expect(lanes).toHaveLength(0);
  });

  it("soporta octopus merges", () => {
    const { rows } = layoutPage([commit("o", ["a", "b", "c"], ["HEAD -> main"]), commit("a")]);

    const parents = rows[0].edges.filter((edge) => edge.kind === "parent");
    expect(parents).toHaveLength(3);
    expect(parents.map((edge) => edge.to)).toEqual([0, 1, 2]);
  });

  it("coloca roots huérfanos reutilizando lanes con ids nuevos", () => {
    const { rows } = layoutPage([commit("x"), commit("y")]);

    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(0);
    expect(rows[0].laneId).not.toBe(rows[1].laneId);
  });

  it("es incremental: paginar da el mismo resultado que una sola pasada", () => {
    const history = [
      commit("m", ["a", "f"], ["HEAD -> main"]),
      commit("f", ["a"], ["feature"]),
      commit("a", ["b"]),
      commit("b", ["c"]),
      commit("c"),
    ];

    const whole = layoutPage(history);
    const first = layoutPage(history.slice(0, 2));
    const second = layoutPage(history.slice(2), first);

    expect(second.rows).toEqual(whole.rows);
    expect(second.colors).toEqual(whole.colors);
    expect(second.lanes).toEqual(whole.lanes);
    expect(second.nextLaneId).toBe(whole.nextLaneId);
  });

  it("produce los mismos colores entre ejecuciones", () => {
    const history = [
      commit("m", ["a", "f"], ["HEAD -> main"]),
      commit("f", ["a"], ["feature"]),
      commit("a", ["b"]),
      commit("b"),
    ];

    expect(layoutPage(history).colors).toEqual(layoutPage(history).colors);
    expect(colorForKey("main")).toBe(colorForKey("main"));
    expect(colorForKey("main")).not.toBe(colorForKey("feature"));
  });

  it("dispone 10 000 commits sin degenerar", () => {
    const history = Array.from({ length: 10_000 }, (_, index) =>
      commit(`c${index}`, index === 9_999 ? [] : [`c${index + 1}`]),
    );

    const { rows, lanes } = layoutPage(history);

    expect(rows).toHaveLength(10_000);
    expect(rows.every((row) => row.lane === 0)).toBe(true);
    expect(lanes).toHaveLength(0);
  });
});
