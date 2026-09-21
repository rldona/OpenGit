import { useEffect, useMemo, useRef, useState } from "react";
import type { MergeOptions } from "../lib/bridge/types";
import { useMergeBranch } from "../lib/hooks/useMergeBranch";
import { useI18n } from "../lib/i18n";
import { DEFAULT_MERGE_OPTIONS } from "../lib/merge";
import { useDiffStore } from "../lib/stores/diff";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { MergeFromLogPanel } from "./MergeFromLogPanel";

type Tab = "log" | "fetched";

function MergeOptionsFields({
  options,
  onChange,
}: {
  options: MergeOptions;
  onChange: (options: MergeOptions) => void;
}) {
  const { t } = useI18n();
  // `--squash` does not commit either: the commit flags stop making sense.
  const commitFlagsDisabled = options.rebase || options.squash;
  return (
    <>
      <fieldset className="remote-options merge-options">
        <legend>{t("common.options")}</legend>
        <label>
          <input
            type="checkbox"
            checked={!options.noCommit}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, noCommit: !event.target.checked })}
          />
          {t("merge.commitImmediately")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.includeMessages}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, includeMessages: event.target.checked })}
          />
          {t("merge.includeMessages")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.noFf}
            disabled={commitFlagsDisabled}
            onChange={(event) => onChange({ ...options, noFf: event.target.checked })}
          />
          {t("merge.noFf")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.squash}
            disabled={options.rebase}
            onChange={(event) => onChange({ ...options, squash: event.target.checked })}
          />
          {t("merge.squash")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.rebase}
            onChange={(event) => onChange({ ...options, rebase: event.target.checked })}
          />
          {t("merge.rebase")}
        </label>
      </fieldset>

      <fieldset className="remote-options merge-options">
        <legend>{t("merge.advanced")}</legend>
        <div className="remote-field">
          <span>{t("merge.conflictResolution")}</span>
          <select
            aria-label={t("merge.strategyAria")}
            value={options.strategy ?? ""}
            disabled={options.rebase}
            onChange={(event) =>
              onChange({
                ...options,
                strategy: (event.target.value || null) as MergeOptions["strategy"],
              })
            }
          >
            <option value="">{t("merge.strategyDefault")}</option>
            <option value="ours">{t("merge.strategyOurs")}</option>
            <option value="theirs">{t("merge.strategyTheirs")}</option>
          </select>
        </div>
        <p className="muted">{t("merge.strategyNote")}</p>
      </fieldset>
    </>
  );
}

/** Branch picker tab; it reports the selected branch to the window. */
function MergeFetchedPanel({ onPick }: { onPick: (rev: string) => void }) {
  const { t } = useI18n();
  const refs = useRefsStore((state) => state.refs);
  const current = useRefsStore((state) => state.current);
  const [rev, setRev] = useState("");

  const branches = useMemo(
    () =>
      refs
        .filter((ref) => ref.name.startsWith("refs/heads/"))
        .map((ref) => ref.name.slice("refs/heads/".length))
        .filter((name) => name !== current),
    [refs, current],
  );

  useEffect(() => {
    onPick(rev);
  }, [rev, onPick]);

  return (
    <div className="merge-tab-panel">
      <div className="remote-field">
        <span>{t("merge.branch")}</span>
        <select
          aria-label={t("merge.branchAria")}
          value={rev}
          onChange={(e) => setRev(e.target.value)}
        >
          <option value="">{t("merge.selectBranch")}</option>
          {branches.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <p className="remote-field">
        <span>{t("merge.intoCurrent")}</span>
        <span className="remote-value">{current ?? t("common.detachedHead")}</span>
      </p>
    </div>
  );
}

/**
 * SourceTree-style merge window (OG-063): a log picker with preview as the
 * default tab, the branch picker as the second one, and the merge options
 * shared at the bottom.
 */
export function MergeWindow({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const runMerge = useMergeBranch(root);
  const [tab, setTab] = useState<Tab>("log");
  const [options, setOptions] = useState<MergeOptions>(DEFAULT_MERGE_OPTIONS);
  const [pickedCommit, setPickedCommit] = useState<string | null>(null);
  const [pickedBranch, setPickedBranch] = useState("");
  const diffSnapshot = useRef(useDiffStore.getState());

  // The preview borrows the diff store; the view behind the modal must not
  // change, so its state is restored when the window closes.
  useEffect(() => {
    const snapshot = diffSnapshot.current;
    return () => useDiffStore.setState(snapshot);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rev = tab === "log" ? pickedCommit : pickedBranch !== "" ? pickedBranch : null;
  const canSubmit = root !== null && rev !== null;

  const submit = async () => {
    if (rev === null) {
      return;
    }
    await runMerge(rev, options);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="merge-window" role="dialog" aria-modal="true" aria-label={t("merge.aria")}>
        <div className="merge-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`merge-tab${tab === "log" ? " active" : ""}`}
            aria-selected={tab === "log"}
            onClick={() => setTab("log")}
          >
            {t("merge.fromLog")}
          </button>
          <button
            type="button"
            role="tab"
            className={`merge-tab${tab === "fetched" ? " active" : ""}`}
            aria-selected={tab === "fetched"}
            onClick={() => setTab("fetched")}
          >
            {t("merge.fetched")}
          </button>
        </div>

        <div className="merge-tab-body">
          <div className={`merge-tab-slot${tab === "log" ? "" : " hidden"}`}>
            {root !== null && <MergeFromLogPanel root={root} onPick={setPickedCommit} />}
          </div>
          <div className={`merge-tab-slot${tab === "fetched" ? "" : " hidden"}`}>
            <MergeFetchedPanel onPick={setPickedBranch} />
          </div>
        </div>

        <MergeOptionsFields options={options} onChange={setOptions} />

        <div className="remote-dialog-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
