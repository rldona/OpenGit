import { useEffect, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import { useLogStore } from "../lib/stores/log";
import { useRefsStore } from "../lib/stores/refs";
import { useRemoteStore } from "../lib/stores/remote";
import { useRepoStore } from "../lib/stores/repo";

export function RefsSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const upstream = useRefsStore((state) => state.upstream);
  const ahead = useRefsStore((state) => state.ahead);
  const behind = useRefsStore((state) => state.behind);
  const filter = useRefsStore((state) => state.filter);
  const error = useRefsStore((state) => state.error);
  const pendingForceDelete = useRefsStore((state) => state.pendingForceDelete);
  const load = useRefsStore((state) => state.load);
  const setFilter = useRefsStore((state) => state.setFilter);
  const checkout = useRefsStore((state) => state.checkout);
  const create = useRefsStore((state) => state.create);
  const rename = useRefsStore((state) => state.rename);
  const remove = useRefsStore((state) => state.remove);
  const forceRemove = useRefsStore((state) => state.forceRemove);
  const cancelForceDelete = useRefsStore((state) => state.cancelForceDelete);
  const selectedCommit = useLogStore((state) => state.selected);

  const createTag = useRefsStore((state) => state.createTag);
  const deleteTag = useRefsStore((state) => state.deleteTag);
  const startRemote = useRemoteStore((state) => state.start);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [typed, setTyped] = useState("");
  const [tagForm, setTagForm] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  const term = filter.trim().toLowerCase();
  const matches = (name: string) => term === "" || name.toLowerCase().includes(term);
  const locals = refs
    .filter((ref) => ref.name.startsWith("refs/heads/"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/heads/".length) }))
    .filter(({ short }) => matches(short));
  const remotes = refs
    .filter((ref) => ref.name.startsWith("refs/remotes/") && !ref.name.endsWith("/HEAD"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/remotes/".length) }))
    .filter(({ short }) => matches(short));
  const tags = refs
    .filter((ref) => ref.name.startsWith("refs/tags/"))
    .map((ref) => ({ ref, short: ref.name.slice("refs/tags/".length) }))
    .filter(({ short }) => matches(short));

  const remoteGroups = new Map<string, typeof remotes>();
  for (const item of remotes) {
    const remote = item.short.split("/")[0];
    remoteGroups.set(remote, [...(remoteGroups.get(remote) ?? []), item]);
  }

  const submitCreate = async () => {
    if (!root || newName.trim() === "") {
      return;
    }
    const ok = await create(root, newName.trim(), selectedCommit ?? "HEAD");
    if (ok) {
      setCreating(false);
      setNewName("");
    }
  };

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

  return (
    <>
      <section className="sidebar-section">
        <h2>Branches</h2>
        <div className="refs-toolbar">
          <input
            type="search"
            aria-label="Filter refs"
            placeholder="Filter…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button
            type="button"
            aria-label="New branch"
            title="New branch"
            onClick={() => setCreating((value) => !value)}
          >
            +
          </button>
        </div>
        {creating && (
          <div className="refs-inline">
            <input
              autoFocus
              aria-label="New branch name"
              placeholder="New branch name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitCreate();
              }}
            />
            <button type="button" onClick={() => void submitCreate()}>
              Create
            </button>
          </div>
        )}
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
                    className={`refs-name${current === short ? " current" : ""}`}
                    title={ref.name}
                    onClick={() => root && void checkout(root, ref)}
                  >
                    {current === short && (
                      <span className="refs-dot" aria-label="Current branch">
                        ●
                      </span>
                    )}
                    {short}
                    {current === short && upstream && (ahead > 0 || behind > 0) && (
                      <span className="refs-track">
                        {ahead > 0 ? `↑${ahead}` : ""}
                        {behind > 0 ? `↓${behind}` : ""}
                      </span>
                    )}
                  </button>
                  <span className="refs-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(short);
                        setRenameValue(short);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => root && void remove(root, short)}
                    >
                      Delete
                    </button>
                  </span>
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
      </section>

      <section className="sidebar-section">
        <h2>Remotes</h2>
        {remoteGroups.size === 0 && <p className="muted">No remote branches</p>}
        {[...remoteGroups.entries()].map(([remote, items]) => (
          <div key={remote}>
            <p className="refs-group">{remote}</p>
            <ul className="refs-list">
              {items.map(({ ref, short }) => (
                <li key={ref.name}>
                  <button
                    type="button"
                    className="refs-name"
                    title={ref.name}
                    onClick={() => root && void checkout(root, ref)}
                  >
                    {short}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="sidebar-section">
        <h2>Tags</h2>
        <div className="refs-toolbar">
          <button
            type="button"
            aria-label="New tag"
            title="New tag"
            onClick={() => setTagForm((value) => !value)}
          >
            +
          </button>
        </div>
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
              <span className="refs-tag">
                <span className={`refs-tag-mark${ref.object_type === "tag" ? " annotated" : ""}`} />
                {short}
              </span>
              <span className="refs-actions">
                <button type="button" onClick={() => pushTag(short)}>
                  Push
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void confirmDeleteTag(short)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {tags.length === 0 && <li className="muted">No tags</li>}
        </ul>
      </section>
      {error && (
        <p role="alert" className="refs-error">
          {error}
        </p>
      )}
    </>
  );
}
