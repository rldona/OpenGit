import { useEffect, useState } from "react";
import { confirmDestructive } from "../lib/bridge/dialog";
import type { ResetMode } from "../lib/bridge/history";
import { copyText } from "../lib/clipboard";
import { formatCommitDate } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useReflogStore } from "../lib/stores/reflog";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Reflog view (OG-089): the recent positions of HEAD with actions to create a
 * branch, reset to an entry, check it out or copy its hash.
 */
export function ReflogView() {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const entries = useReflogStore((state) => state.entries);
  const loading = useReflogStore((state) => state.loading);
  const error = useReflogStore((state) => state.error);
  const createBranchAt = useReflogStore((state) => state.createBranchAt);
  const checkout = useReflogStore((state) => state.checkout);
  const reset = useReflogStore((state) => state.reset);
  const [mode, setMode] = useState<ResetMode>("mixed");
  const [branchFor, setBranchFor] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    if (root === null) {
      return;
    }
    useReflogStore.getState().resetState();
    void useReflogStore.getState().load(root);
  }, [root]);

  if (root === null) {
    return null;
  }

  const submitBranch = async (hash: string) => {
    if (branchName.trim() === "") {
      return;
    }
    await createBranchAt(root, hash, branchName.trim());
    setBranchFor(null);
    setBranchName("");
  };

  const doReset = async (hash: string) => {
    if (
      mode === "hard" &&
      !(await confirmDestructive(t("reflog.hardResetConfirm", { hash: hash.slice(0, 7) })))
    ) {
      return;
    }
    await reset(root, hash, mode);
  };

  return (
    <div className="reflog-view">
      <div className="reflog-toolbar">
        <span className="muted">{t("reflog.title")}</span>
        <label className="reflog-mode">
          <span>{t("reflog.resetMode")}</span>
          <select
            aria-label={t("reflog.resetModeAria")}
            value={mode}
            onChange={(event) => setMode(event.target.value as ResetMode)}
          >
            <option value="soft">{t("reflog.soft")}</option>
            <option value="mixed">{t("reflog.mixed")}</option>
            <option value="hard">{t("reflog.hard")}</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {loading && <p className="muted">{t("common.loading")}</p>}

      <ul className="reflog-list">
        {entries.map((entry) => (
          <li key={`${entry.selector}-${entry.hash}`} className="reflog-entry">
            <div className="reflog-info">
              <span className="reflog-selector">{entry.selector}</span>
              <span className="reflog-hash">{entry.hash.slice(0, 7)}</span>
              <span className="reflog-subject">{entry.subject}</span>
              <span className="reflog-meta">
                {entry.author} · {formatCommitDate(entry.time)}
              </span>
            </div>
            <div className="reflog-actions">
              <button
                type="button"
                onClick={() => {
                  setBranchFor(entry.hash);
                  setBranchName("");
                }}
              >
                {t("reflog.createBranch")}
              </button>
              <button type="button" onClick={() => void doReset(entry.hash)}>
                {t("reflog.reset")}
              </button>
              <button type="button" onClick={() => void checkout(root, entry.hash)}>
                {t("reflog.checkout")}
              </button>
              <button type="button" onClick={() => void copyText(entry.hash)}>
                {t("reflog.copy")}
              </button>
            </div>
            {branchFor === entry.hash && (
              <form
                className="reflog-branch"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitBranch(entry.hash);
                }}
              >
                <input
                  aria-label={t("reflog.branchNameAria")}
                  autoFocus
                  value={branchName}
                  placeholder={t("reflog.branchPlaceholder")}
                  onChange={(event) => setBranchName(event.target.value)}
                />
                <button type="submit" disabled={branchName.trim() === ""}>
                  {t("common.create")}
                </button>
                <button type="button" onClick={() => setBranchFor(null)}>
                  {t("common.cancel")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
