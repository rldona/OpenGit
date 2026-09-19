import { useCallback, useEffect, useRef, useState } from "react";
import { formatCommitDate } from "../lib/format";
import type { BlameLine } from "../lib/bridge/types";
import { sameRange, visibleRange, type VisibleRange } from "../lib/graph/viewport";
import { useBlameStore } from "../lib/stores/blame";
import { useLogStore } from "../lib/stores/log";
import { useUiStore } from "../lib/stores/ui";

const BLAME_ROW_HEIGHT = 20;
const UNCOMMITTED = /^0+$/;

/** Per-line blame with the author, date and commit of each line (OG-055). */
export function BlameView() {
  const root = useBlameStore((state) => state.root);
  const file = useBlameStore((state) => state.file);
  const lines = useBlameStore((state) => state.lines);
  const loading = useBlameStore((state) => state.loading);
  const error = useBlameStore((state) => state.error);
  const revealCommit = useLogStore((state) => state.revealCommit);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<VisibleRange>({ start: 0, end: 0 });

  const updateRange = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const next = visibleRange(
      scroller.scrollTop,
      scroller.clientHeight,
      lines.length,
      6,
      BLAME_ROW_HEIGHT,
    );
    setRange((current) => (sameRange(current, next) ? current : next));
  }, [lines.length]);

  useEffect(() => {
    updateRange();
  }, [updateRange]);

  const jump = (hash: string) => {
    if (!root || UNCOMMITTED.test(hash)) {
      return;
    }
    void revealCommit(root, hash).then(() => setActiveView("history"));
  };

  const visible: Array<{ index: number; line: BlameLine }> = [];
  for (let index = range.start; index < range.end; index += 1) {
    const line = lines[index];
    if (line) {
      visible.push({ index, line });
    }
  }

  return (
    <div className="blame">
      <div className="blame-head">
        <span className="muted">Blame:</span>
        <span className="blame-path" title={file ?? ""}>
          {file}
        </span>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {loading && <p className="muted status-empty">Loading…</p>}
      {!loading && !error && lines.length === 0 && (
        <p className="muted status-empty">Nothing to blame</p>
      )}
      {lines.length > 0 && (
        <div className="blame-list" ref={scrollRef} onScroll={updateRange}>
          <div className="blame-inner" style={{ height: lines.length * BLAME_ROW_HEIGHT }}>
            {visible.map(({ index, line }) => (
              <button
                key={index}
                type="button"
                className="blame-row"
                style={{ top: index * BLAME_ROW_HEIGHT }}
                onClick={() => jump(line.hash)}
              >
                <span className="blame-line-no">{line.line}</span>
                <span className="blame-hash">
                  {UNCOMMITTED.test(line.hash) ? "uncommitted" : line.hash.slice(0, 7)}
                </span>
                <span className="blame-author" title={line.author_name}>
                  {line.author_name}
                </span>
                <span className="blame-date">{formatCommitDate(line.author_time)}</span>
                <code className="blame-content">{line.content}</code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
