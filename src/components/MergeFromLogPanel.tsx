import { useEffect, useMemo, useRef, useState } from "react";
import { listRefs, logPage } from "../lib/bridge/log";
import type { Commit, RefEntry } from "../lib/bridge/types";
import { formatCommitDate, shortRefName } from "../lib/format";
import {
  ROW_HEIGHT,
  emptyLayout,
  graphWidth as graphWidthFor,
  layoutPage,
  visibleLaneCount,
  type GraphLayout,
} from "../lib/graph/layout";
import { useDiffStore } from "../lib/stores/diff";
import { DiffFilesPanel } from "./DiffFilesPanel";
import { DiffPatchPanel } from "./DiffPatchPanel";
import { GraphCanvas } from "./GraphCanvas";

const PAGE_SIZE = 200;
const HASH_WIDTH = 70;

type Props = {
  root: string;
  /** Rev picked in the table; null while nothing is selected. */
  onPick: (rev: string | null) => void;
};

/**
 * Log picker of the merge window (OG-063): commit table with graph, filters,
 * jump-to and the selected commit preview. It works over the first page
 * (200 commits) plus text search; infinite scroll inside a modal is a
 * follow-up if it hurts.
 */
export function MergeFromLogPanel({ root, onPick }: Props) {
  const [refs, setRefs] = useState<RefEntry[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [layout, setLayout] = useState<GraphLayout>(emptyLayout);
  const [rev, setRev] = useState("");
  const [showRemotes, setShowRemotes] = useState(false);
  const [ancestorsOnly, setAncestorsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [jump, setJump] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingJump = useRef(false);
  const lastOpened = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const gitRev = rev !== "" ? rev : ancestorsOnly ? "HEAD" : null;

  useEffect(() => {
    void listRefs(root)
      .then(setRefs)
      .catch(() => setRefs([]));
  }, [root]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    logPage(root, 0, PAGE_SIZE, gitRev, null)
      .then((page) => {
        if (cancelled) {
          return;
        }
        setCommits(page);
        setLayout(
          layoutPage(
            page.map((commit) => ({
              hash: commit.hash,
              parents: commit.parents,
              refs: commit.refs,
            })),
          ),
        );
        setLoading(false);
        if (pendingJump.current) {
          pendingJump.current = false;
          setPicked(page[0]?.hash ?? null);
        } else {
          setPicked((current) =>
            current && page.some((commit) => commit.hash === current) ? current : null,
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [root, gitRev]);

  useEffect(() => {
    onPick(picked);
    if (picked === null || lastOpened.current === picked) {
      return;
    }
    lastOpened.current = picked;
    void useDiffStore.getState().openCommit(root, picked);
    const scroller = scrollRef.current;
    const index = commits.findIndex((commit) => commit.hash === picked);
    if (!scroller || index < 0) {
      return;
    }
    const top = index * ROW_HEIGHT;
    if (top < scroller.scrollTop || top + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = Math.max(0, top - Math.round(scroller.clientHeight / 3));
    }
  }, [picked, root, commits, onPick]);

  const branchOptions = useMemo(
    () =>
      refs.filter(
        (ref) =>
          ref.name.startsWith("refs/heads/") ||
          (showRemotes && ref.name.startsWith("refs/remotes/") && !ref.name.endsWith("/HEAD")),
      ),
    [refs, showRemotes],
  );
  const jumpOptions = useMemo(
    () =>
      refs.filter(
        (ref) =>
          !ref.name.endsWith("/HEAD") && (showRemotes || !ref.name.startsWith("refs/remotes/")),
      ),
    [refs, showRemotes],
  );

  const jumpTo = (name: string) => {
    setJump(name);
    if (name === "") {
      return;
    }
    const ref = refs.find((item) => item.name === name);
    const target = ref ? (ref.target ?? ref.object_id) : null;
    const index = target ? commits.findIndex((commit) => commit.hash === target) : -1;
    if (target !== null && index >= 0) {
      setPicked(target);
      const scroller = scrollRef.current;
      if (scroller) {
        scroller.scrollTop = index * ROW_HEIGHT;
      }
      return;
    }
    // Not in the loaded page: reload pointing at the ref and pick its head.
    pendingJump.current = true;
    setRev(name);
  };

  const needle = search.trim().toLowerCase();
  const searching = needle !== "";
  const shown = searching
    ? commits.filter((commit) => commit.subject.toLowerCase().includes(needle))
    : commits;
  const laneCount = visibleLaneCount(layout.rows, 0, commits.length);
  const graphWidth = searching ? 0 : graphWidthFor(laneCount);

  return (
    <div className="merge-tab-panel">
      <div className="merge-log-toolbar">
        <select
          aria-label="Filter branch"
          value={rev}
          onChange={(event) => setRev(event.target.value)}
        >
          <option value="">All Branches</option>
          {branchOptions.map((ref) => (
            <option key={ref.name} value={ref.name}>
              {shortRefName(ref.name)}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={showRemotes}
            onChange={(event) => setShowRemotes(event.target.checked)}
          />
          Show Remote Branches
        </label>
        <label>
          <input
            type="checkbox"
            checked={ancestorsOnly}
            onChange={(event) => setAncestorsOnly(event.target.checked)}
          />
          Ancestor Order
        </label>
        <input
          type="search"
          aria-label="Search commits"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="merge-jump">
          Jump to:
          <select
            aria-label="Jump to"
            value={jump}
            onChange={(event) => jumpTo(event.target.value)}
          >
            <option value="">Select a ref</option>
            {jumpOptions.map((ref) => (
              <option key={ref.name} value={ref.name}>
                {shortRefName(ref.name)}
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="muted">Loading…</span>}
      </div>

      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}

      <div className="merge-log-wrap">
        <div className="merge-log-list" ref={scrollRef}>
          {!searching && commits.length > 0 && (
            <GraphCanvas
              className="merge-graph"
              rows={layout.rows}
              colors={layout.colors}
              laneCount={laneCount}
              selected={picked}
              scrollRef={scrollRef}
            />
          )}
          <div className="merge-log-inner" style={{ height: shown.length * ROW_HEIGHT }}>
            {shown.map((commit, index) => (
              <button
                key={commit.hash}
                type="button"
                className={`merge-log-row${picked === commit.hash ? " selected" : ""}`}
                style={{ top: index * ROW_HEIGHT, paddingLeft: graphWidth }}
                onClick={() => setPicked(commit.hash)}
              >
                <span className="commit-subject">{commit.subject}</span>
                <span className="commit-hash" style={{ width: HASH_WIDTH }}>
                  {commit.hash.slice(0, 7)}
                </span>
                <span className="commit-date">{formatCommitDate(commit.author_time)}</span>
              </button>
            ))}
          </div>
          {!loading && shown.length === 0 && (
            <p className="muted status-empty">No commits to show</p>
          )}
        </div>

        <div className="merge-preview">
          <DiffFilesPanel />
          <DiffPatchPanel />
        </div>
      </div>
    </div>
  );
}
