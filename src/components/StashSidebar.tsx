import { useEffect, useRef, useState } from "react";
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
import { StashDialog } from "./StashDialog";

export function StashSidebar() {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const stashes = useStashStore((state) => state.stashes);
  const error = useStashStore((state) => state.error);
  const load = useStashStore((state) => state.load);
  const apply = useStashStore((state) => state.apply);
  const pop = useStashStore((state) => state.pop);
  const drop = useStashStore((state) => state.drop);
  const select = useStashStore((state) => state.select);
  const selected = useStashStore((state) => state.diffReference);

  const newStashRequest = useUiStore((state) => state.newStashRequest);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const [stashDialog, setStashDialog] = useState(false);
  const stashMenu = useContextMenu();

  useEffect(() => {
    if (root) {
      void load(root);
    }
  }, [root, load]);

  // The Stash button in the toolbar opens the same dialog as the menu. Like
  // the branch one, it reacts to increments only: remounting when a repository
  // opens would otherwise pop the dialog with a stale counter.
  const handledNewStash = useRef(newStashRequest);
  useEffect(() => {
    if (newStashRequest === handledNewStash.current) {
      return;
    }
    handledNewStash.current = newStashRequest;
    setStashDialog(true);
    useCollapseStore.getState().set("stashes", false);
  }, [newStashRequest]);

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
          stashMenu.open(event, [{ label: "Stash Changes…", onSelect: () => setStashDialog(true) }])
        }
      >
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
      {stashDialog && <StashDialog onClose={() => setStashDialog(false)} />}
      {stashMenu.menu}
    </>
  );
}
