import { useEffect } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import type { FileStatus } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useDiffStore } from "../lib/stores/diff";
import { useStatusStore } from "../lib/stores/status";
import { useUiStore } from "../lib/stores/ui";
import { CommitPanel } from "./CommitPanel";

type SectionKey = "conflicts" | "staged" | "unstaged" | "untracked";

type Section = {
  key: SectionKey;
  title: string;
  entries: FileStatus[];
};

function buildSections(entries: FileStatus[]): Section[] {
  return [
    {
      key: "conflicts",
      title: "Conflicts",
      entries: entries.filter((entry) => entry.kind === "unmerged"),
    },
    {
      key: "staged",
      title: "Staged",
      entries: entries.filter(
        (entry) => entry.kind !== "unmerged" && entry.kind !== "untracked" && entry.xy[0] !== ".",
      ),
    },
    {
      key: "unstaged",
      title: "Unstaged",
      entries: entries.filter(
        (entry) => entry.kind !== "unmerged" && entry.kind !== "untracked" && entry.xy[1] !== ".",
      ),
    },
    {
      key: "untracked",
      title: "Untracked",
      entries: entries.filter((entry) => entry.kind === "untracked"),
    },
  ];
}

export function StatusView() {
  const repo = useRepoStore((state) => state.repo);
  const report = useStatusStore((state) => state.report);
  const filter = useStatusStore((state) => state.filter);
  const selected = useStatusStore((state) => state.selected);
  const loading = useStatusStore((state) => state.loading);
  const load = useStatusStore((state) => state.load);
  const setFilter = useStatusStore((state) => state.setFilter);
  const select = useStatusStore((state) => state.select);
  const stage = useStatusStore((state) => state.stage);
  const unstage = useStatusStore((state) => state.unstage);
  const discard = useStatusStore((state) => state.discard);
  const removeUntracked = useStatusStore((state) => state.removeUntracked);
  const openWorktreeFile = useDiffStore((state) => state.openWorktreeFile);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const root = repo?.root ?? null;

  const openDiff = async (entry: FileStatus, staged: boolean) => {
    if (!root) {
      return;
    }
    select(entry.path);
    await openWorktreeFile(root, entry.path, staged);
    setActiveView("diff");
  };

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const term = filter.trim().toLowerCase();
  const sections = buildSections(report?.entries ?? []).map((section) => ({
    ...section,
    entries: term
      ? section.entries.filter(
          (entry) =>
            entry.path.toLowerCase().includes(term) ||
            (entry.orig_path ?? "").toLowerCase().includes(term),
        )
      : section.entries,
  }));
  const total = report?.entries.length ?? 0;

  const confirmAndRun = async (entry: FileStatus, action: "discard" | "delete") => {
    const message =
      action === "discard"
        ? `Discard changes in ${entry.path}? This cannot be undone.`
        : `Delete untracked file ${entry.path}? This cannot be undone.`;
    const confirmed = await confirmDestructive(message);
    if (!confirmed) {
      return;
    }
    if (action === "discard") {
      await discard(entry.path, entry.orig_path);
    } else {
      await removeUntracked(entry.path);
    }
  };

  return (
    <div className="status-view" aria-label="File status">
      <div className="status-toolbar">
        <label className="status-filter">
          <span>Filter</span>
          <input
            type="search"
            value={filter}
            placeholder="File name"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <span className="muted">
          {total} change(s){loading ? " · Loading…" : ""}
        </span>
      </div>

      <div className="status-list">
        {report && total === 0 && <p className="muted status-empty">No changes</p>}
        {sections
          .filter((section) => section.entries.length > 0)
          .map((section) => (
            <section key={section.key} className="status-section">
              <h3>
                {section.title} <span className="count">{section.entries.length}</span>
              </h3>
              {section.entries.map((entry) => (
                <div
                  key={`${section.key}-${entry.path}`}
                  className={`status-row${selected === entry.path ? " selected" : ""}`}
                  onClick={() => void openDiff(entry, section.key === "staged")}
                >
                  <span className="status-xy">{entry.xy}</span>
                  <span className="status-path">
                    {entry.path}
                    {entry.orig_path && <span className="muted"> ← {entry.orig_path}</span>}
                  </span>
                  <span className="status-actions" onClick={(event) => event.stopPropagation()}>
                    {section.key === "staged" && (
                      <button
                        type="button"
                        onClick={() => void unstage(entry.path, entry.orig_path)}
                      >
                        Unstage
                      </button>
                    )}
                    {(section.key === "unstaged" || section.key === "untracked") && (
                      <button type="button" onClick={() => void stage(entry.path, entry.orig_path)}>
                        Stage
                      </button>
                    )}
                    {section.key === "unstaged" && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void confirmAndRun(entry, "discard")}
                      >
                        Discard
                      </button>
                    )}
                    {section.key === "untracked" && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void confirmAndRun(entry, "delete")}
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </section>
          ))}
      </div>
      <CommitPanel />
    </div>
  );
}
