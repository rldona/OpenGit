import { useEffect, useRef } from "react";
import { GRAPH_COLORS, LANE_WIDTH, ROW_HEIGHT, type GraphRow } from "../lib/graph/layout";

const PADDING = 8;
const NODE_RADIUS = 4;

type Props = {
  rows: GraphRow[];
  colors: Record<number, string>;
  scrollTop: number;
  viewportHeight: number;
  laneCount: number;
  selected: string | null;
};

export function GraphCanvas({
  rows,
  colors,
  scrollTop,
  viewportHeight,
  laneCount,
  selected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = laneCount * LANE_WIDTH + PADDING * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(viewportHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, viewportHeight);
    context.lineWidth = 2;
    context.lineCap = "round";

    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 1);
    const last = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + 1);
    const x = (lane: number) => PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const colorOf = (laneId: number) => colors[laneId] ?? GRAPH_COLORS[0];

    for (let index = first; index < last; index += 1) {
      const row = rows[index];
      const top = index * ROW_HEIGHT - scrollTop;
      const center = top + ROW_HEIGHT / 2;
      const bottom = top + ROW_HEIGHT;

      const converging = new Set(
        row.edges.filter((edge) => edge.kind === "converge").map((edge) => `${edge.from}`),
      );
      row.before.forEach((lane, position) => {
        if (lane.expects === null) {
          return;
        }
        if (position !== row.lane && converging.has(`${position}`)) {
          return;
        }
        context.strokeStyle = colorOf(lane.id);
        context.beginPath();
        context.moveTo(x(position), top);
        context.lineTo(x(position), position === row.lane ? center : bottom);
        context.stroke();
      });

      row.edges.forEach((edge) => {
        context.strokeStyle = colorOf(edge.laneId);
        context.beginPath();
        if (edge.kind === "converge") {
          const midY = (top + center) / 2;
          context.moveTo(x(edge.from), top);
          context.bezierCurveTo(x(edge.from), midY, x(edge.to), midY, x(edge.to), center);
        } else if (edge.from === edge.to) {
          context.moveTo(x(edge.from), center);
          context.lineTo(x(edge.to), bottom);
        } else {
          const midY = (center + bottom) / 2;
          context.moveTo(x(edge.from), center);
          context.bezierCurveTo(x(edge.from), midY, x(edge.to), midY, x(edge.to), bottom);
        }
        context.stroke();
      });

      const nodeX = x(row.lane);
      context.fillStyle = colorOf(row.laneId);
      context.beginPath();
      context.arc(nodeX, center, NODE_RADIUS, 0, Math.PI * 2);
      context.fill();
      if (selected === row.hash) {
        context.strokeStyle = "#ffffff";
        context.beginPath();
        context.arc(nodeX, center, NODE_RADIUS + 3, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [rows, colors, scrollTop, viewportHeight, laneCount, selected, width]);

  return (
    <canvas
      ref={canvasRef}
      className="history-graph"
      aria-hidden="true"
      style={{ width, height: viewportHeight, top: scrollTop }}
    />
  );
}
