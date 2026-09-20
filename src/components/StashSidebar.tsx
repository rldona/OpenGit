import { useEffect, useState } from "react";
import { copyText } from "../lib/clipboard";
import { confirmDestructive } from "../lib/bridge/dialog";
import { formatDateTime } from "../lib/format";
import { useContextMenu } from "../lib/hooks/useContextMenu";
import type { Stash } from "../lib/bridge/types";
import { useRepoStore } from "../lib/stores/repo";
import { useCollapseStore } from "../lib/stores/collapse";
import { useStashStore } from "../lib/stores/stash";
import { useUiStore } from "../lib/stores/ui";
import { CollapsibleSection } from "./CollapsibleSection";

export function StashSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const stashes = useStashStore((state) => state.stashes);
  const error = useStashStore((state) => state.error);
  const load = useStashStore((state) => state.load);
  const create = useStashStore((state) => state.create);
  const apply = useStashStore((state) => state.apply);
  const pop = useStashStore((state) => state.pop);
  const drop = useStashStore((state) => state.drop);
  const select = useStashStore((state) => state.select);
  const selected = useStashStore((state) => state.diffReference);

  const newStashRequest = useUiStore((state) => state.newStashRequest);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const [form, setForm] = useState(false);
  const [message, setMessage] = useState("");
  const [untracked, setUntracked] = useState(false);
  const stashMenu = useContextMenu();

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  // El botón Stash de la barra reutiliza este formulario (ver RefsSidebar).
  useEffect(() => {
    if (newStashRequest > 0) {
      setForm(true);
      useCollapseStore.getState().set("stashes", false);
    }
  }, [newStashRequest]);

  const submit = async () => {
    if (!root) {
      return;
    }
    const ok = await create(root, message.trim() === "" ? null : message.trim(), untracked);
    if (ok) {
      setForm(false);
      setMessage("");
      setUntracked(false);
    }
  };

  const confirmDrop = async (reference: string) => {
    if (root && (await confirmDestructive(`Drop ${reference}? This cannot be undone.`))) {
      await drop(root, reference);
    }
  };

  const open = (reference: string) => {
    if (!root) {
      return;
    }
    setActiveView("stash");
    void select(root, reference);
  };

  const menuFor = (stash: Stash) => [
    { label: "Open", onSelect: () => open(stash.reference) },
    { label: "Apply", onSelect: () => root && void apply(root, stash.reference) },
    { label: "Pop", onSelect: () => root && void pop(root, stash.reference) },
    { label: "Drop", danger: true, onSelect: () => void confirmDrop(stash.reference) },
    { label: "Copy reference", onSelect: () => void copyText(stash.reference) },
  ];

  return (
    <>
      <CollapsibleSection
        id="stashes"
        title="Stashes"
        icon="stash"
        onContextMenu={(event) =>
          stashMenu.open(event, [{ label: "Stash Changes…", onSelect: () => setForm(true) }])
        }
      >
        {form && (
          <div className="refs-inline refs-stash-form">
            <input
              autoFocus
              aria-label="Stash message"
              placeholder="Message (optional)"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <label className="refs-check">
              <input
                type="checkbox"
                checked={untracked}
                onChange={(event) => setUntracked(event.target.checked)}
              />
              Include untracked
            </label>
            <button type="button" onClick={() => void submit()}>
              Stash
            </button>
          </div>
        )}
        <ul className="refs-list">
          {stashes.map((stash) => (
            <li key={stash.hash} className="refs-item">
              <button
                type="button"
                className={`refs-stash${selected === stash.reference ? " selected" : ""}`}
                title={stash.reference}
                onClick={() => open(stash.reference)}
                onContextMenu={(event) => stashMenu.open(event, menuFor(stash))}
              >
                <span className="refs-stash-subject">{stash.subject}</span>
                <span className="refs-stash-date muted">{formatDateTime(stash.timestamp)}</span>
              </button>
            </li>
          ))}
          {stashes.length === 0 && <li className="muted">No stashes</li>}
        </ul>
        {error && (
          <p role="alert" className="refs-error">
            {error}
          </p>
        )}
      </CollapsibleSection>
      {stashMenu.menu}
    </>
  );
}
