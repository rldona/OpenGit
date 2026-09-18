import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime, shortRefName } from "../lib/format";
import { LANE_WIDTH, ROW_HEIGHT } from "../lib/graph/layout";
import type { Commit } from "../lib/bridge/types";
import { useLogStore } from "../lib/stores/log";
import { useRepoStore } from "../lib/stores/repo";
import { GraphCanvas } from "./GraphCanvas";

const OVERSCAN = 6;
const GRAPH_PADDING = 16;

export function HistoryView() {
  const repo = useRepoStore((state) => state.repo);
  const commits = useLogStore((state) => state.commits);
  const layout = useLogStore((state) => state.layout);
  const refs = useLogStore((state) => state.refs);
  const filter = useLogStore((state) => state.filter);
  const selected = useLogStore((state) => state.selected);
  const loading = useLogStore((state) => state.loading);
  const hasMore = useLogStore((state) => state.hasMore);
  const load = useLogStore((state) => state.load);
  const loadMore = useLogStore((state) => state.loadMore);
  const setFilter = useLogStore((state) => state.setFilter);
  const select = useLogStore((state) => state.select);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const root = repo?.root ?? null;

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const update = () => setViewportHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    setScrollTop(element.scrollTop);
    if (element.scrollHeight - element.scrollTop - element.clientHeight < ROW_HEIGHT * 12) {
      void loadMore();
    }
  }, [loadMore]);

  const laneCount = layout.rows.reduce(
    (max, row) => Math.max(max, row.lane + 1, row.before.length, row.after.length),
    1,
  );
  const graphWidth = laneCount * LANE_WIDTH + GRAPH_PADDING;
  const rows = layout.rows;

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visible = rows.slice(first, last);
  const selectedCommit = selected
    ? (commits.find((commit) => commit.hash === selected) ?? null)
    : null;
  const branchRefs = refs.filter(
    (ref) => ref.name.startsWith("refs/heads/") || ref.name.startsWith("refs/remotes/"),
  );

  return (
    <div className="history">
      <div className="history-toolbar">
        <label className="history-filter">
          <span>Rama</span>
          <select
            value={filter ?? ""}
            onChange={(event) => {
              if (root) {
                void setFilter(root, event.target.value || null);
              }
            }}
          >
            <option value="">Todas las ramas</option>
            {branchRefs.map((ref) => (
              <option key={ref.name} value={ref.name}>
                {shortRefName(ref.name)}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {commits.length} commits{hasMore ? "+" : ""}
        </span>
        {loading && <span className="muted">Cargando…</span>}
      </div>

      <div className="history-body">
        <div className="history-list" ref={containerRef} onScroll={handleScroll}>
          <div className="history-inner" style={{ height: rows.length * ROW_HEIGHT }}>
            <GraphCanvas
              rows={rows}
              colors={layout.colors}
              scrollTop={scrollTop}
              viewportHeight={viewportHeight}
              laneCount={laneCount}
              selected={selected}
            />
            {visible.map((row, offset) => {
              const index = first + offset;
              const commit = commits[index];
              if (!commit) {
                return null;
              }
              return (
                <button
                  key={row.hash}
                  type="button"
                  className={`commit-row${selected === row.hash ? " selected" : ""}`}
                  style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                  onClick={() => select(row.hash)}
                >
                  <span className="commit-refs">{renderRefs(commit.refs)}</span>
                  <span className="commit-subject">{commit.subject}</span>
                  <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
                  <span className="commit-author">{commit.author_name}</span>
                  <span className="commit-date">{formatDateTime(commit.author_time)}</span>
                </button>
              );
            })}
          </div>
        </div>
        {selectedCommit && <CommitDetail commit={selectedCommit} onClose={() => select(null)} />}
      </div>
    </div>
  );
}

function renderRefs(refValues: string[]) {
  const shown = refValues.slice(0, 3);
  return (
    <>
      {shown.map((value) => (
        <RefBadge key={value} value={value} />
      ))}
      {refValues.length > shown.length && (
        <span className="muted">+{refValues.length - shown.length}</span>
      )}
    </>
  );
}

function RefBadge({ value }: { value: string }) {
  if (value === "HEAD") {
    return <span className="ref-badge head">HEAD</span>;
  }
  if (value.startsWith("HEAD -> ")) {
    return <span className="ref-badge head">{value.slice("HEAD -> ".length)}</span>;
  }
  if (value.startsWith("tag: ")) {
    return <span className="ref-badge tag">{value.slice("tag: ".length)}</span>;
  }
  if (value.includes("/")) {
    return <span className="ref-badge remote">{value}</span>;
  }
  return <span className="ref-badge branch">{value}</span>;
}

function CommitDetail({ commit, onClose }: { commit: Commit; onClose: () => void }) {
  return (
    <aside className="commit-detail" aria-label="Detalle del commit">
      <header>
        <h2>Commit</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar detalle">
          ×
        </button>
      </header>
      <p className="mono break">{commit.hash}</p>
      <p>
        <strong>{commit.author_name}</strong> &lt;{commit.author_email}&gt;
      </p>
      <p className="muted">{formatDateTime(commit.author_time)}</p>
      <p className="commit-detail-subject">{commit.subject}</p>
      <p className="muted">
        {commit.parents.length} padre(s) · {commit.refs.length} ref(s)
      </p>
    </aside>
  );
}
