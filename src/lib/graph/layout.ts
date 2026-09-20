/**
 * Layout del grafo de commits (ADR-0004). Función pura e incremental:
 * los commits llegan en orden topológico inverso (nuevo → viejo) y el estado
 * de las lanes se reutiliza entre páginas para no recalcular lo ya pintado.
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
  /** Lane cuyo color pinta la línea. */
  laneId: number;
};

export type GraphRow = {
  hash: string;
  /** Posición (columna) del nodo. */
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

/** Color determinista para una clave estable (nombre de rama o hash). */
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

    // Otras lanes que esperaban este commit convergen en el nodo.
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
