import { useMemo, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import {
  classifyPatchLines,
  patchCounts,
  splitPatchByFile,
  stripPatchHeader,
} from "../lib/diff/patch";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";
import { Icon } from "./Icon";

/** The git stash subject stores the branch: `WIP on main: …` or `On main: …`. */
function originBranch(subject: string): string | null {
  const match = /^(?:WIP on|On) ([^:]+): /.exec(subject);
  return match ? match[1] : null;
}

function FilePatch({
  path,
  patch,
  open,
  onToggle,
}: {
  path: string;
  patch: string;
  open: boolean;
  onToggle: () => void;
}) {
  const lines = stripPatchHeader(classifyPatchLines(patch));
  const counts = patchCounts(patch);

  return (
    <section className="stash-file">
      <div className="stash-file-head">
        <button
          type="button"
          className="stash-file-toggle"
          aria-expanded={open}
          aria-label={`Toggle ${path}`}
          onClick={onToggle}
        >
          <span className="file-tree-caret">{open ? "▾" : "▸"}</span>
        </button>
        <Icon name="folder" size={13} />
        <span className="stash-file-path" title={path}>
          {path}
        </span>
        <span className="diff-counts">
          <span className="added">+{counts.added}</span>
          <span className="deleted">-{counts.deleted}</span>
        </span>
      </div>
      {open && (
        <>
          <div className="stash-file-label">File contents</div>
          <div className="stash-file-patch">
            {lines.map((line) => (
              <div key={line.index} className={`patch-line ${line.type}`}>
                <span className="patch-line-no">{line.oldLine ?? ""}</span>
                <span className="patch-line-no">{line.newLine ?? ""}</span>
                <span className="patch-text">{line.text === "" ? " " : line.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Detail of a stash embedded in the main area, like SourceTree (OG-046). */
export function StashView() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const reference = useStashStore((state) => state.diffReference);
  const patch = useStashStore((state) => state.diffPatch);
  const loading = useStashStore((state) => state.diffLoading);
  const error = useStashStore((state) => state.diffError);
  const stashes = useStashStore((state) => state.stashes);
  const apply = useStashStore((state) => state.apply);
  const pop = useStashStore((state) => state.pop);
  const drop = useStashStore((state) => state.drop);
  const [closed, setClosed] = useState<string[]>([]);

  const stash = stashes.find((item) => item.reference === reference) ?? null;
  const files = useMemo(() => splitPatchByFile(patch), [patch]);
  const branch = stash ? originBranch(stash.subject) : null;

  if (!reference) {
    return (
      <div className="stash-view" aria-label="Stash">
        <p className="muted status-empty">Select a stash to see its changes</p>
      </div>
    );
  }

  const confirmDrop = async () => {
    if (root && (await confirmDestructive(`Drop ${reference}? This cannot be undone.`))) {
      await drop(root, reference);
    }
  };

  return (
    <div className="stash-view" aria-label="Stash">
      <div className="stash-toolbar">
        <div className="stash-title-wrap">
          <h2 className="stash-title">{stash?.subject ?? reference}</h2>
          <span className="stash-branch muted">{branch ? `from ${branch}` : reference}</span>
        </div>
        <div className="stash-actions">
          <button type="button" onClick={() => root && void apply(root, reference)}>
            Apply
          </button>
          <button type="button" onClick={() => root && void pop(root, reference)}>
            Pop
          </button>
          <button type="button" className="danger" onClick={() => void confirmDrop()}>
            Drop
          </button>
        </div>
      </div>

      <div className="stash-body">
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        {loading && <p className="muted status-empty">Loading…</p>}
        {!loading && !error && files.length === 0 && (
          <p className="muted status-empty">No changes in this stash</p>
        )}
        {!loading &&
          files.map((file) => (
            <FilePatch
              key={file.path}
              path={file.path}
              patch={file.patch}
              open={!closed.includes(file.path)}
              onToggle={() =>
                setClosed((current) =>
                  current.includes(file.path)
                    ? current.filter((path) => path !== file.path)
                    : [...current, file.path],
                )
              }
            />
          ))}
      </div>
    </div>
  );
}
