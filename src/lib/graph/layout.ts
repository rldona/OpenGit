/**
 * Commit graph layout (ADR-0004). Pure and incremental function:
 * commits arrive in reverse topological order (new → old) and lane state
 * is reused between pages to avoid recomputing what is already painted.
 */

export type GraphInput = {
  hash: string;
  parents: string[];
  refs: string[];
};

export type GraphLane = {
  id: number;
  expects: string | null;
  colorKey: string;
};

export type LaneSnapshot = {
  id: number;
  expects: string | null;
};

export type GraphEdge = {
  kind: "parent" | "converge";
  from: number;
  to: number;
  /** Lane whose color paints the line. */
  laneId: number;
};

export type GraphRow = {
  hash: string;
  /** Position (column) of the node. */
  lane: number;
  laneId: number;
  before: LaneSnapshot[];
  after: LaneSnapshot[];
  edges: GraphEdge[];
};

export type GraphLayout = {
  rows: GraphRow[];
  colors: Record<number, string>;
  lanes: GraphLane[];
  nextLaneId: number;
};

export const LANE_WIDTH = 14;
export const ROW_HEIGHT = 28;

/** Cap on painted lanes: beyond it the graph is clipped instead of pushing the text. */
export const MAX_GRAPH_LANES = 12;
/** The width is rounded to blocks so the text does not shake while scrolling. */
const LANE_BLOCK = 4;
const GRAPH_PADDING = 16;

/**
 * Lanes needed to paint `rows[start..end)`.
 *
 * Measured over the visible range, not over the whole history: if at some
 * point the repo has 27 open branches, computing it globally would indent
 * *all* rows by hundreds of pixels even if only four lanes are on screen.
 */
export function visibleLaneCount(rows: GraphRow[], start: number, end: number): number {
  let max = 1;
  for (let index = Math.max(0, start); index < Math.min(rows.length, end); index += 1) {
    const row = rows[index];
    max = Math.max(max, row.lane + 1, row.before.length, row.after.length);
  }
  return Math.min(max, MAX_GRAPH_LANES);
}

/**
 * Width of the graph column, rounded up to blocks of `LANE_BLOCK`.
 * The rounding is the hysteresis: without it, crossing a merge while scrolling
 * would move the text of all rows horizontally.
 */
export function graphWidth(laneCount: number): number {
  const capped = Math.min(Math.max(laneCount, 1), MAX_GRAPH_LANES);
  const blocks = Math.ceil(capped / LANE_BLOCK) * LANE_BLOCK;
  return Math.min(blocks, MAX_GRAPH_LANES) * LANE_WIDTH + GRAPH_PADDING;
}

export const GRAPH_COLORS = [
  "#5b8def",
  "#e0a458",
  "#6cc070",
  "#d06b8f",
  "#9a7bd8",
  "#4fb3bf",
  "#c7c14b",
  "#e07b5b",
];

export function emptyLayout(): GraphLayout {
  return { rows: [], colors: {}, lanes: [], nextLaneId: 1 };
}

/** Deterministic color for a stable key (branch name or hash). */
export function colorForKey(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return GRAPH_COLORS[Math.abs(hash) % GRAPH_COLORS.length];
}

function primaryRef(commit: GraphInput): string | null {
  if (commit.refs.length === 0) return null;
  const head = commit.refs.find((ref) => ref.startsWith("HEAD -> "));
  if (head) return head.slice("HEAD -> ".length);
  const branch = commit.refs.find(
    (ref) => ref !== "HEAD" && !ref.startsWith("tag: ") && !ref.includes("/"),
  );
  if (branch) return branch;
  const tag = commit.refs.find((ref) => ref.startsWith("tag: "));
  if (tag) return tag.slice("tag: ".length);
  return commit.refs[0];
}

function assignColor(layout: GraphLayout, position: number, key: string): void {
  layout.lanes[position].colorKey = key;
  layout.colors[layout.lanes[position].id] = colorForKey(key);
}

export function layoutPage(commits: GraphInput[], previous?: GraphLayout): GraphLayout {
  const layout: GraphLayout = previous
    ? {
        rows: [...previous.rows],
        colors: { ...previous.colors },
        lanes: previous.lanes.map((lane) => ({ ...lane })),
        nextLaneId: previous.nextLaneId,
      }
    : emptyLayout();
  const { lanes } = layout;

  for (const commit of commits) {
    const before: LaneSnapshot[] = lanes.map((lane) => ({ id: lane.id, expects: lane.expects }));

    const expected = lanes
      .map((lane, index) => ({ expects: lane.expects, index }))
      .filter((item) => item.expects === commit.hash)
      .map((item) => item.index);
    let position = expected[0] ?? -1;
    if (position === -1) {
      position = lanes.findIndex((lane) => lane.expects === null);
      if (position === -1) {
        position = lanes.length;
        lanes.push({ id: layout.nextLaneId, expects: null, colorKey: commit.hash });
      } else {
        lanes[position] = { id: layout.nextLaneId, expects: null, colorKey: commit.hash };
      }
      layout.nextLaneId += 1;
      layout.colors[lanes[position].id] = colorForKey(commit.hash);
    }

    const refKey = primaryRef(commit);
    if (refKey) assignColor(layout, position, refKey);

    const laneId = lanes[position].id;
    const edges: GraphEdge[] = [];

    // Other lanes that were expecting this commit converge at the node.
    expected.slice(1).forEach((index) => {
      edges.push({ kind: "converge", from: index, to: position, laneId: lanes[index].id });
      lanes[index] = { ...lanes[index], expects: null };
    });

    lanes[position].expects = null;

    commit.parents.forEach((parent, index) => {
      if (index === 0) {
        lanes[position].expects = parent;
        edges.push({ kind: "parent", from: position, to: position, laneId });
        return;
      }
      let target = lanes.findIndex((lane) => lane.expects === parent);
      if (target === -1) {
        target = lanes.findIndex((lane) => lane.expects === null);
        if (target === -1) {
          target = lanes.length;
          lanes.push({ id: layout.nextLaneId, expects: parent, colorKey: parent });
        } else {
          lanes[target] = { id: layout.nextLaneId, expects: parent, colorKey: parent };
        }
        layout.nextLaneId += 1;
        layout.colors[lanes[target].id] = colorForKey(parent);
      }
      edges.push({ kind: "parent", from: position, to: target, laneId: lanes[target].id });
    });

    layout.rows.push({
      hash: commit.hash,
      lane: position,
      laneId,
      before,
      after: lanes.map((lane) => ({ id: lane.id, expects: lane.expects })),
      edges,
    });
  }

  while (lanes.length > 0 && lanes[lanes.length - 1].expects === null) {
    lanes.pop();
  }
  return layout;
}
