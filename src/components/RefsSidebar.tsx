import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { openExternal } from "../lib/bridge/opener";
import { remoteRemove } from "../lib/bridge/repo";
import type { RefEntry } from "../lib/bridge/types";
import { parseTrack } from "../lib/format";
import { useI18n } from "../lib/i18n";
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
  const { t } = useI18n();
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
    if (await confirmDestructive(t("refs.mergeConfirm", { rev, target }))) {
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
    if (root && (await confirmDestructive(t("refs.deleteTagConfirm", { name })))) {
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
    const confirmed = await confirmDestructive(t("refs.removeRemoteConfirm", { name }));
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
      useUiStore.getState().appendOutput(t("refs.remoteRemoved", { name }));
    } catch (err) {
      setRemoteError(formatGitError(err));
    }
  };

  return (
    <>
      <CollapsibleSection
        id="branches"
        title={t("refs.branches")}
        icon="branch"
        onContextMenu={(event) =>
          refMenu.open(event, [
            { label: t("refs.newBranch"), onSelect: () => setBranchDialog(true) },
            {
              label: t("refs.newTag"),
              onSelect: () => {
                setTagForm(true);
                useCollapseStore.getState().set("tags", false);
              },
            },
            // Like in SourceTree. Subtree still has no backend: it stays
            // disabled so as not to promise what does not exist.
            {
              label: t("refs.newRemote"),
              onSelect: () => setRemoteDialog({ mode: "add", field: "both", name: null }),
            },
            { label: t("refs.addSubmodule"), onSelect: () => setSubmoduleDialog(true) },
            { label: t("refs.addSubtree"), disabled: true, onSelect: () => {} },
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
                    aria-label={t("refs.renameAria", { name: short })}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submitRename(short);
                    }}
                  />
                  <button type="button" onClick={() => void submitRename(short)}>
                    {t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(null);
                      setRenameValue("");
                    }}
                  >
                    {t("common.cancel")}
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
                        {
                          label: t("refs.checkout"),
                          onSelect: () => root && void checkout(root, ref),
                        },
                        {
                          label: t("refs.mergeInto", { target: current ?? "HEAD" }),
                          disabled: current === short,
                          onSelect: () => void confirmMerge(short),
                        },
                        {
                          label: t("refs.compareSelected"),
                          disabled: compareRefs.length !== 2,
                          onSelect: compareSelectedRefs,
                        },
                        {
                          label: t("refs.rename"),
                          onSelect: () => {
                            setRenaming(short);
                            setRenameValue(short);
                          },
                        },
                        {
                          label: t("common.delete"),
                          danger: true,
                          disabled: current === short,
                          onSelect: () => root && void remove(root, short),
                        },
                        { label: t("refs.copyName"), onSelect: () => void copyText(short) },
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
                  <span className="muted">{t("refs.typeToForce", { name: short })}</span>
                  <input
                    aria-label={t("refs.confirmForce", { name: short })}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => root && void forceRemove(root, short, typed)}
                  >
                    {t("refs.forceDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTyped("");
                      cancelForceDelete();
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </li>
          ))}
          {locals.length === 0 && <li className="muted">{t("refs.noBranches")}</li>}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        id="remotes"
        title={t("refs.remotes")}
        icon="cloud"
        onContextMenu={(event) =>
          refMenu.open(event, [
            {
              label: t("refs.newRemote"),
              onSelect: () => setRemoteDialog({ mode: "add", field: "both", name: null }),
            },
          ])
        }
      >
        {remoteGroups.size === 0 && <p className="muted">{t("refs.noRemoteBranches")}</p>}
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
                    label: t("refs.editUrl"),
                    onSelect: () => setRemoteDialog({ mode: "edit", field: "url", name: remote }),
                  },
                  {
                    label: t("refs.renameRemote"),
                    onSelect: () => setRemoteDialog({ mode: "edit", field: "name", name: remote }),
                  },
                  {
                    label: t("common.remove"),
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
                      title={t("refs.openInBrowser", { url: webUrl })}
                      aria-label={t("refs.openRemoteAria", { name: remote })}
                      onClick={() => void openExternal(webUrl)}
                    >
                      ↗
                    </button>
                  )}
                </>
              }
            >
              {items.length === 0 && <p className="muted">{t("refs.noBranchesFetched")}</p>}
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
                          {
                            label: t("refs.checkout"),
                            onSelect: () => root && void checkout(root, ref),
                          },
                          { label: t("refs.copyName"), onSelect: () => void copyText(short) },
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
        title={t("refs.tags")}
        icon="tag"
        onContextMenu={(event) =>
          refMenu.open(event, [{ label: t("refs.newTag"), onSelect: () => setTagForm(true) }])
        }
      >
        {tagForm && (
          <div className="refs-inline refs-tag-form">
            <input
              autoFocus
              aria-label={t("refs.tagNameAria")}
              placeholder={t("refs.tagName")}
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
            />
            <label className="refs-check">
              <input
                type="checkbox"
                checked={tagAnnotated}
                onChange={(event) => setTagAnnotated(event.target.checked)}
              />
              {t("refs.annotated")}
            </label>
            {tagAnnotated && (
              <input
                aria-label={t("refs.tagMessage")}
                placeholder={t("refs.tagMessage")}
                value={tagMessage}
                onChange={(event) => setTagMessage(event.target.value)}
              />
            )}
            <button type="button" onClick={() => void submitTag()}>
              {t("common.create")}
            </button>
          </div>
        )}
        <ul className="refs-list">
          {tags.map(({ ref, short }) => (
            <li
              key={ref.name}
              className="refs-item"
              title={ref.object_type === "tag" ? t("refs.annotatedTag") : t("refs.lightweightTag")}
            >
              <button
                type="button"
                className={`refs-tag${selectedRef === ref.name ? " selected" : ""}`}
                title={ref.name}
                onClick={() => reveal(ref)}
                onContextMenu={(event) =>
                  refMenu.open(event, [
                    { label: t("refs.showInHistory"), onSelect: () => reveal(ref) },
                    { label: t("refs.push"), onSelect: () => pushTag(short) },
                    {
                      label: t("common.delete"),
                      danger: true,
                      onSelect: () => void confirmDeleteTag(short),
                    },
                    { label: t("refs.copyName"), onSelect: () => void copyText(short) },
                  ])
                }
              >
                <span className={`refs-tag-mark${ref.object_type === "tag" ? " annotated" : ""}`} />
                {short}
              </button>
            </li>
          ))}
          {tags.length === 0 && <li className="muted">{t("refs.noTags")}</li>}
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
