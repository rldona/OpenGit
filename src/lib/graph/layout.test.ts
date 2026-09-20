import { describe, expect, it } from "vitest";
import {
  MAX_GRAPH_LANES,
  colorForKey,
  graphWidth,
  layoutPage,
  visibleLaneCount,
  type GraphInput,
  type GraphRow,
} from "./layout";

function commit(hash: string, parents: string[] = [], refs: string[] = []): GraphInput {
  return { hash, parents, refs };
}

describe("layoutPage", () => {
  it("draws a linear history in a single lane", () => {
    const { rows, lanes } = layoutPage([commit("c", ["b"]), commit("b", ["a"]), commit("a")]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(new Set(rows.map((row) => row.laneId)).size).toBe(1);
    expect(rows[0].edges).toEqual([{ kind: "parent", from: 0, to: 0, laneId: rows[0].laneId }]);
    expect(rows[2].edges).toHaveLength(0);
    expect(lanes).toHaveLength(0);
  });

  it("assigns stable lanes and colors per branch in a merge", () => {
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

  it("supports octopus merges", () => {
    const { rows } = layoutPage([commit("o", ["a", "b", "c"], ["HEAD -> main"]), commit("a")]);

    const parents = rows[0].edges.filter((edge) => edge.kind === "parent");
    expect(parents).toHaveLength(3);
    expect(parents.map((edge) => edge.to)).toEqual([0, 1, 2]);
  });

  it("places orphan roots reusing lanes with new ids", () => {
    const { rows } = layoutPage([commit("x"), commit("y")]);

    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(0);
    expect(rows[0].laneId).not.toBe(rows[1].laneId);
  });

  it("is incremental: paging gives the same result as a single pass", () => {
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

  it("produces the same colors across runs", () => {
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

  it("lays out 10,000 commits without degrading", () => {
    const history = Array.from({ length: 10_000 }, (_, index) =>
      commit(`c${index}`, index === 9_999 ? [] : [`c${index + 1}`]),
    );

    const { rows, lanes } = layoutPage(history);

    expect(rows).toHaveLength(10_000);
    expect(rows.every((row) => row.lane === 0)).toBe(true);
    expect(lanes).toHaveLength(0);
  });
});

function row(lane: number): GraphRow {
  const lanes = Array.from({ length: lane + 1 }, (_, id) => ({ id, expects: null }));
  return { hash: `h${lane}`, lane, laneId: lane, before: lanes, after: lanes, edges: [] };
}

describe("visibleLaneCount", () => {
  it("measures only the visible range, not the whole history", () => {
    // 27 lanes at the end of the history must not indent the rows above.
    const rows = [row(0), row(1), row(2), row(26)];

    expect(visibleLaneCount(rows, 0, 3)).toBe(3);
    expect(visibleLaneCount(rows, 3, 4)).toBe(MAX_GRAPH_LANES);
  });

  it("never goes below one lane nor exceeds the cap", () => {
    expect(visibleLaneCount([], 0, 0)).toBe(1);
    expect(visibleLaneCount([row(99)], 0, 1)).toBe(MAX_GRAPH_LANES);
  });

  it("tolerates out-of-bounds ranges", () => {
    const rows = [row(0), row(1)];

    expect(visibleLaneCount(rows, -5, 99)).toBe(2);
  });
});

describe("graphWidth", () => {
  it("rounds to blocks so the text does not shake while scrolling", () => {
    // Crossing from 1 to 4 lanes must not move the text even one pixel.
    const uno = graphWidth(1);

    expect(graphWidth(2)).toBe(uno);
    expect(graphWidth(3)).toBe(uno);
    expect(graphWidth(4)).toBe(uno);
    expect(graphWidth(5)).toBeGreaterThan(uno);
  });

  it("applies the cap no matter how many lanes there are", () => {
    expect(graphWidth(999)).toBe(graphWidth(MAX_GRAPH_LANES));
  });

  it("grows monotonically", () => {
    const anchos = [1, 4, 5, 8, 9, 12].map(graphWidth);

    for (let i = 1; i < anchos.length; i += 1) {
      expect(anchos[i]).toBeGreaterThanOrEqual(anchos[i - 1]);
    }
  });
});
