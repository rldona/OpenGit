import { useCallback, useEffect, useRef, type RefObject } from "react";
import { GRAPH_COLORS, LANE_WIDTH, ROW_HEIGHT, type GraphRow } from "../lib/graph/layout";
import { useThemeStore } from "../lib/stores/theme";
import { selectionRingColor } from "../lib/theme";

const PADDING = 8;
const NODE_RADIUS = 4;

type Props = {
  rows: GraphRow[];
  colors: Record<number, string>;
  laneCount: number;
  selected: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Filas que la lista antepone al historial (p. ej. Uncommitted changes). */
  offset?: number;
  /** Dibuja el nodo hueco de "Uncommitted changes" sobre HEAD. */
  worktree?: boolean;
};

/**
 * Capa de canvas fija sobre la lista (no se mueve con el scroll): lee
 * `scrollTop` al dibujar y repinta en el siguiente frame, antes del paint.
 */
export function GraphCanvas({
  rows,
  colors,
  laneCount,
  selected,
  scrollRef,
  offset = 0,
  worktree = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, ratio: 0 });
  const theme = useThemeStore((state) => state.resolved);
  const selectionColor = selectionRingColor(theme);
  const width = laneCount * LANE_WIDTH + PADDING * 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    if (!canvas || !scroller) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const height = scroller.clientHeight;
    const bufferWidth = Math.max(1, Math.floor(width * ratio));
    const bufferHeight = Math.max(1, Math.floor(height * ratio));
    const size = sizeRef.current;
    if (size.width !== bufferWidth || size.height !== bufferHeight || size.ratio !== ratio) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      sizeRef.current = { width: bufferWidth, height: bufferHeight, ratio };
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const scrollTop = scroller.scrollTop;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = 2;
    context.lineCap = "round";

    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - offset - 1);
    const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) - offset + 1);
    const x = (lane: number) => PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const colorOf = (laneId: number) => colors[laneId] ?? GRAPH_COLORS[0];

    if (worktree && rows.length > 0) {
      // Nodo hueco en la primera fila de la lista, conectado con HEAD.
      const lane = rows[0].lane;
      const nodeCenter = ROW_HEIGHT / 2 - scrollTop;
      const headCenter = offset * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
      context.strokeStyle = colorOf(rows[0].laneId);
      context.beginPath();
      context.moveTo(x(lane), nodeCenter + NODE_RADIUS);
      context.lineTo(x(lane), headCenter - NODE_RADIUS);
      context.stroke();
      context.strokeStyle = selectionColor;
      context.beginPath();
      context.arc(x(lane), nodeCenter, NODE_RADIUS, 0, Math.PI * 2);
      context.stroke();
    }

    for (let index = first; index < last; index += 1) {
      const row = rows[index];
      const top = (index + offset) * ROW_HEIGHT - scrollTop;
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
        context.strokeStyle = selectionColor;
        context.beginPath();
        context.arc(nodeX, center, NODE_RADIUS + 3, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [rows, colors, selected, scrollRef, width, selectionColor, offset, worktree]);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const onScroll = () => schedule();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => schedule());
    observer.observe(scroller);
    schedule();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scrollRef, schedule]);

  return <canvas ref={canvasRef} className="history-graph" aria-hidden="true" />;
}
