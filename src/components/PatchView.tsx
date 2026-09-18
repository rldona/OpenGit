import { useCallback, useEffect, useRef, useState } from "react";
import type { HunkSelection } from "../lib/bridge/diff";
import { classifyPatchLines, parseHunkHeader, PATCH_ROW_HEIGHT } from "../lib/diff/patch";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";

const OVERSCAN = 8;

type Props = {
  patch: string;
  /** Hay staging disponible (working tree o index; nunca en commits). */
  staging: boolean;
  /** El parche viene del index: las acciones son unstage. */
  stagedSide: boolean;
  selectedLines: number[];
  onToggleLine: (index: number) => void;
  onApply: (selection: HunkSelection) => void;
  /** Presente en el lado unstaged: descarta el hunk del working tree. */
  onDiscard?: (selection: HunkSelection) => void;
};

export function PatchView({
  patch,
  staging,
  stagedSide,
  selectedLines,
  onToggleLine,
  onApply,
  onDiscard,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<VisibleRange>({ start: 0, end: 0 });
  const lines = classifyPatchLines(patch);

  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const next = visibleRange(
      scroller.scrollTop,
      scroller.clientHeight,
      lines.length,
      OVERSCAN,
      PATCH_ROW_HEIGHT,
    );
    setRange((current) => (sameRange(current, next) ? current : next));
  }, [lines.length]);

  useEffect(() => {
    update();
  }, [update]);

  const actionLabel = stagedSide ? "Unstage hunk" : "Stage hunk";

  return (
    <div className="patch-view" ref={scrollerRef} onScroll={update}>
      <div className="patch-inner" style={{ height: lines.length * PATCH_ROW_HEIGHT }}>
        {lines.slice(range.start, range.end).map((line, offset) => {
          const index = range.start + offset;
          const top = index * PATCH_ROW_HEIGHT;
          if (line.type === "hunk") {
            const header = parseHunkHeader(line.text);
            const lastLine = header ? header.newStart + Math.max(header.newCount, 1) - 1 : null;
            const label =
              header && lastLine !== null
                ? `Hunk ${(line.hunk ?? 0) + 1} · Lines ${header.newStart}–${lastLine}`
                : line.text;
            return (
              <div key={line.index} className="patch-line hunk" style={{ top }}>
                <span className="patch-hunk-label" title={line.text}>
                  {label}
                </span>
                <span className="patch-hunk-section">{header?.section ?? ""}</span>
                {staging && (
                  <span className="patch-actions">
                    <button
                      type="button"
                      className="patch-action"
                      onClick={() => onApply({ kind: "hunk", index: line.hunk ?? 0 })}
                    >
                      {actionLabel}
                    </button>
                    {onDiscard && !stagedSide && (
                      <button
                        type="button"
                        className="patch-action danger"
                        onClick={() => onDiscard({ kind: "hunk", index: line.hunk ?? 0 })}
                      >
                        Discard hunk
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          }
          const selectable = staging && (line.type === "add" || line.type === "del");
          const selected = selectable && selectedLines.includes(line.index);
          return (
            <div
              key={line.index}
              className={`patch-line ${line.type}${selected ? " selected" : ""}${
                selectable ? " selectable" : ""
              }`}
              style={{ top }}
              onClick={selectable ? () => onToggleLine(line.index) : undefined}
            >
              <span className="patch-line-no">{line.oldLine ?? ""}</span>
              <span className="patch-line-no">{line.newLine ?? ""}</span>
              <span className="patch-text">{line.text === "" ? " " : line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
