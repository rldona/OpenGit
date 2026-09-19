import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { openExternal } from "../lib/bridge/opener";
import { remoteRemove } from "../lib/bridge/repo";
import type { RefEntry } from "../lib/bridge/types";
import { parseTrack } from "../lib/format";
import { DEFAULT_MERGE_OPTIONS } from "../lib/merge";
import { useMergeBranch } from "../lib/hooks/useMergeBranch";
import { useExtrasStore } from "../lib/stores/extras";
import { useLogStore } from "../lib/stores/log";
import { useDiffStore } from "../lib/stores/diff";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import { useDragSource } from "../lib/hooks/useDragSource";
import { useCollapseStore } from "../lib/stores/collapse";
import { useUiStore } from "../lib/stores/ui";
import { CollapsibleSection } from "./CollapsibleSection";
import { RemoteDialog, type RemoteDialogField, type RemoteDialogMode } from "./RemoteDialog";
import { BranchDialog } from "./BranchDialog";
import { SubmoduleDialog } from "./SubmoduleDialog";

type RemoteDialogState = {
  mode: RemoteDialogMode;
  field: RemoteDialogField;
  name: string | null;
};

export function RefsSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const error = useRefsStore((state) => state.error);
  const pendingForceDelete = useRefsStore((state) => state.pendingForceDelete);
  const load = useRefsStore((state) => state.load);
  const checkout = useRefsStore((state) => state.checkout);
  const remoteInfos = useExtrasStore((state) => state.remotes);
  const rename = useRefsStore((state) => state.rename);
  const remove = useRefsStore((state) => state.remove);
  const forceRemove = useRefsStore((state) => state.forceRemove);
  const cancelForceDelete = useRefsStore((state) => state.cancelForceDelete);
  const selectedCommit = useLogStore((state) => state.selected);
  const revealCommit = useLogStore((state) => state.revealCommit);
  const openCompare = useDiffStore((state) => state.openCompare);
  const newBranchRequest = useUiStore((state) => state.newBranchRequest);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const createTag = useRefsStore((state) => state.createTag);
  const deleteTag = useRefsStore((state) => state.deleteTag);
  const startRemote = useRemoteStore((state) => state.start);

  const [branchDialog, setBranchDialog] = useState(false);
  const refMenu = useContextMenu();
  // Visual selection: checkout is only done from the context menu.
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [compareRefs, setCompareRefs] = useState<Array<{ name: string; target: string }>>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [typed, setTyped] = useState("");
  const [tagForm, setTagForm] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialogState | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [submoduleDialog, setSubmoduleDialog] = useState(false);

  useEffect(() => {
    if (root) {
      void load(root);
    }
    setSelectedRef(null);
  }, [root, load]);

  // The Branch button in the toolbar opens the same dialog as the menu. The
  // counter lives in the UI store, so it must react to increments only: the
  // component remounts when a repository opens and a stale value would pop the
  // dialog on its own.
  const handledNewBranch = useRef(newBranchRequest);
  useEffect(() => {
    if (newBranchRequest === handledNewBranch.current) {
      return;
    }
    handledNewBranch.current = newBranchRequest;
    setBranchDialog(true);
    useCollapseStore.getState().set("branches", false);
  }, [newBranchRequest]);

  const runMerge = useMergeBranch(root);

  const confirmMerge = async (rev: string) => {
    const target = current ?? "HEAD";
    if (await confirmDestructive(`Merge ${rev} into ${target}?`)) {
      await runMerge(rev, DEFAULT_MERGE_OPTIONS);
    }
  };

  // Dropping a branch on the history merges it into the current branch (OG-060).
  const branchDrag = useDragSource((payload, target) => {
    if (payload.kind === "branch" && target === "merge") {
      void confirmMerge(payload.rev);
    }
  });

  // Clicking a branch or a tag locates its commit in the history and selects it.
  const reveal = (ref: RefEntry) => {
    if (!root) {
      return;
    }
    setCompareRefs([]);
    setSelectedRef(ref.name);
    setActiveView("history");
    void revealCommit(root, ref.target);
  };

  // Ctrl/Cmd+click keeps two branches to compare their commits (OG-054).
  const toggleCompareRef = (ref: RefEntry) => {
    setCompareRefs((current) => {
      if (current.some((item) => item.name === ref.name)) {
        return current.filter((item) => item.name !== ref.name);
      }
      return [...current, { name: ref.name, target: ref.target }].slice(-2);
    });
  };

  const compareSelectedRefs = () => {
    if (!root || compareRefs.length !== 2) {
      return;
    }
    void openCompare(root, compareRefs[0].target, compareRefs[1].target).then(() =>
      setActiveView("diff"),
    );
  };

  const compareIndexFor = (name: string) => compareRefs.findIndex((item) => item.name === name);

  const locals = refs
    .filter((ref) => ref.name.startsWith("refs/heads/"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/heads/".length) }));
  const remotes = refs
    .filter((ref) => ref.name.startsWith("refs/remotes/") && !ref.name.endsWith("/HEAD"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/remotes/".length) }));
  const tags = refs
    .filter((ref) => ref.name.startsWith("refs/tags/"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/tags/".length) }));

  const remoteGroups = new Map<string, typeof remotes>();
  for (const item of remotes) {
    const remote = item.short.split("/")[0];
    remoteGroups.set(remote, [...(remoteGroups.get(remote) ?? []), item]);
  }
  // A just-added remote has no fetched branches yet, but it must still show up.
  for (const info of remoteInfos) {
    if (!remoteGroups.has(info.name)) {
      remoteGroups.set(info.name, []);
    }
  }

  const submitRename = async (oldName: string) => {
    if (!root || renameValue.trim() === "") {
      return;
    }
    const ok = await rename(root, oldName, renameValue.trim());
    if (ok) {
      setRenaming(null);
      setRenameValue("");
    }
  };

  const submitTag = async () => {
    if (!root || tagName.trim() === "") {
      return;
    }
    const ok = await createTag(
      root,
      tagName.trim(),
      selectedCommit ?? "HEAD",
      tagAnnotated ? tagMessage : null,
    );
    if (ok) {
      setTagForm(false);
      setTagName("");
      setTagMessage("");
      setTagAnnotated(false);
    }
  };

  const confirmDeleteTag = async (name: string) => {
    if (root && (await confirmDestructive(`Delete tag ${name}? This cannot be undone.`))) {
      await deleteTag(root, name);
    }
  };

  const pushTag = (name: string) => {
    if (root) {
      void startRemote(root, { kind: "push_tag", remote: null, tag: name });
    }
  };

  const remoteFor = (name: string) => remoteInfos.find((entry) => entry.name === name) ?? null;

  const confirmRemoveRemote = async (name: string) => {
    if (!root) {
      return;
    }
    const confirmed = await confirmDestructive(
      `Remove remote ${name}? Its remote branches disappear from the repo.`,
    );
    if (!confirmed) {
      return;
    }
    setRemoteError(null);
    try {
      await remoteRemove(root, name);
      await Promise.all([
        useExtrasStore.getState().refresh(root),
        useRefsStore.getState().refresh(root),
      ]);
      useUiStore.getState().appendOutput(`Remote ${name} removed`);
    } catch (err) {
      setRemoteError(formatGitError(err));
    }
  };

  return (
    <>
      <CollapsibleSection
        id="branches"
        title="Branches"
        icon="branch"
        onContextMenu={(event) =>
          refMenu.open(event, [
            { label: "New Branch…", onSelect: () => setBranchDialog(true) },
            {
              label: "New Tag…",
              onSelect: () => {
                setTagForm(true);
                useCollapseStore.getState().set("tags", false);
              },
            },
            // Like in SourceTree. Subtree still has no backend: it stays
            // disabled so as not to promise what does not exist.
            {
              label: "New Remote…",
              onSelect: () => setRemoteDialog({ mode: "add", field: "both", name: null }),
            },
            { label: "Add Submodule…", onSelect: () => setSubmoduleDialog(true) },
            { label: "Add/Link Subtree…", disabled: true, onSelect: () => {} },
          ])
        }
      >
        <ul className="refs-list">
          {locals.map(({ ref, short }) => (
            <li key={ref.name} className="refs-item">
              {renaming === short ? (
                <div className="refs-inline">
                  <input
                    autoFocus
                    aria-label={`Rename ${short}`}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submitRename(short);
                    }}
                  />
                  <button type="button" onClick={() => void submitRename(short)}>
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(null);
                      setRenameValue("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`refs-name${current === short ? " current" : ""}${
                      selectedRef === ref.name ? " selected" : ""
                    }${compareIndexFor(ref.name) >= 0 ? " compare-selected" : ""}`}
                    title={ref.name}
                    aria-current={current === short ? "true" : undefined}
                    onPointerDown={(event) => {
                      if (current !== short) {
                        branchDrag.start(event, { kind: "branch", rev: short });
                      }
                    }}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey) {
                        toggleCompareRef(ref);
                        return;
                      }
                      reveal(ref);
                    }}
                    onContextMenu={(event) =>
                      refMenu.open(event, [
                        { label: "Checkout", onSelect: () => root && void checkout(root, ref) },
                        {
                          label: `Merge into ${current ?? "HEAD"}`,
                          disabled: current === short,
                          onSelect: () => void confirmMerge(short),
                        },
                        {
                          label: "Compare selected",
                          disabled: compareRefs.length !== 2,
                          onSelect: compareSelectedRefs,
                        },
                        {
                          label: "Rename",
                          onSelect: () => {
                            setRenaming(short);
                            setRenameValue(short);
                          },
                        },
                        {
                          label: "Delete",
                          danger: true,
                          disabled: current === short,
                          onSelect: () => root && void remove(root, short),
                        },
                        { label: "Copy name", onSelect: () => void copyText(short) },
                      ])
                    }
                  >
                    {short}
                    {compareIndexFor(ref.name) >= 0 && (
                      <span className="commit-compare">{compareIndexFor(ref.name) + 1}</span>
                    )}
                  </button>
                  {(() => {
                    const track = parseTrack(ref.track);
                    if (!track || (track.ahead === 0 && track.behind === 0)) {
                      return null;
                    }
                    // Like SourceTree: counter first and arrow after, in a
                    // badge that is visible at a glance (12↓).
                    return (
                      <span className="refs-track">
                        {track.ahead > 0 && <span>{track.ahead}↑</span>}
                        {track.behind > 0 && <span>{track.behind}↓</span>}
                      </span>
                    );
                  })()}
                </>
              )}
              {pendingForceDelete === short && (
                <div className="refs-force">
                  <span className="muted">Type {short} to force delete</span>
                  <input
                    aria-label={`Confirm force delete ${short}`}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => root && void forceRemove(root, short, typed)}
                  >
                    Force delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTyped("");
                      cancelForceDelete();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
          {locals.length === 0 && <li className="muted">No branches</li>}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        id="remotes"
        title="Remotes"
        icon="cloud"
        onContextMenu={(event) =>
          refMenu.open(event, [
            {
              label: "New Remote…",
              onSelect: () => setRemoteDialog({ mode: "add", field: "both", name: null }),
            },
          ])
        }
      >
        {remoteGroups.size === 0 && <p className="muted">No remote branches</p>}
        {[...remoteGroups.entries()].map(([remote, items]) => {
          const webUrl = remoteInfos.find((entry) => entry.name === remote)?.web_url ?? null;
          return (
            <CollapsibleSection
              key={remote}
              id={`remote:${remote}`}
              title={remote}
              nested
              defaultCollapsed
              onContextMenu={(event) =>
                refMenu.open(event, [
                  {
                    label: "Edit URL…",
                    onSelect: () => setRemoteDialog({ mode: "edit", field: "url", name: remote }),
                  },
                  {
                    label: "Rename…",
                    onSelect: () => setRemoteDialog({ mode: "edit", field: "name", name: remote }),
                  },
                  {
                    label: "Remove",
                    danger: true,
                    onSelect: () => void confirmRemoveRemote(remote),
                  },
                ])
              }
              extra={
                <>
                  {webUrl && (
                    <button
                      type="button"
                      className="refs-open-remote"
                      title={`Open ${webUrl} in the browser`}
                      aria-label={`Open ${remote} in the browser`}
                      onClick={() => void openExternal(webUrl)}
                    >
                      ↗
                    </button>
                  )}
                </>
              }
            >
              {items.length === 0 && <p className="muted">No branches fetched yet</p>}
              <ul className="refs-list">
                {items.map(({ ref, short }) => (
                  <li key={ref.name}>
                    <button
                      type="button"
                      className={`refs-name${selectedRef === ref.name ? " selected" : ""}`}
                      title={ref.name}
                      onClick={() => reveal(ref)}
                      onContextMenu={(event) =>
                        refMenu.open(event, [
                          { label: "Checkout", onSelect: () => root && void checkout(root, ref) },
                          { label: "Copy name", onSelect: () => void copyText(short) },
                        ])
                      }
                    >
                      {short}
                    </button>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          );
        })}
      </CollapsibleSection>
      <CollapsibleSection
        id="tags"
        title="Tags"
        icon="tag"
        onContextMenu={(event) =>
          refMenu.open(event, [{ label: "New Tag…", onSelect: () => setTagForm(true) }])
        }
      >
        {tagForm && (
          <div className="refs-inline refs-tag-form">
            <input
              autoFocus
              aria-label="New tag name"
              placeholder="Tag name"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
            />
            <label className="refs-check">
              <input
                type="checkbox"
                checked={tagAnnotated}
                onChange={(event) => setTagAnnotated(event.target.checked)}
              />
              Annotated
            </label>
            {tagAnnotated && (
              <input
                aria-label="Tag message"
                placeholder="Tag message"
                value={tagMessage}
                onChange={(event) => setTagMessage(event.target.value)}
              />
            )}
            <button type="button" onClick={() => void submitTag()}>
              Create
            </button>
          </div>
        )}
        <ul className="refs-list">
          {tags.map(({ ref, short }) => (
            <li
              key={ref.name}
              className="refs-item"
              title={ref.object_type === "tag" ? "Annotated tag" : "Lightweight tag"}
            >
              <button
                type="button"
                className={`refs-tag${selectedRef === ref.name ? " selected" : ""}`}
                title={ref.name}
                onClick={() => reveal(ref)}
                onContextMenu={(event) =>
                  refMenu.open(event, [
                    { label: "Show in history", onSelect: () => reveal(ref) },
                    { label: "Push", onSelect: () => pushTag(short) },
                    {
                      label: "Delete",
                      danger: true,
                      onSelect: () => void confirmDeleteTag(short),
                    },
                    { label: "Copy name", onSelect: () => void copyText(short) },
                  ])
                }
              >
                <span className={`refs-tag-mark${ref.object_type === "tag" ? " annotated" : ""}`} />
                {short}
              </button>
            </li>
          ))}
          {tags.length === 0 && <li className="muted">No tags</li>}
        </ul>
      </CollapsibleSection>
      {error && (
        <p role="alert" className="refs-error">
          {error}
        </p>
      )}
      {remoteError && (
        <p role="alert" className="refs-error">
          {remoteError}
        </p>
      )}
      {remoteDialog && (
        <RemoteDialog
          mode={remoteDialog.mode}
          field={remoteDialog.field}
          remote={remoteDialog.name ? remoteFor(remoteDialog.name) : null}
          onClose={() => setRemoteDialog(null)}
        />
      )}
      {submoduleDialog && <SubmoduleDialog onClose={() => setSubmoduleDialog(false)} />}
      {branchDialog && <BranchDialog onClose={() => setBranchDialog(false)} />}
      {refMenu.menu}
    </>
  );
}
