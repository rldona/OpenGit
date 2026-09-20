import { useEffect, useState } from "react";
import { pickDirectory } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { gitignoreTemplates, initRepo } from "../lib/bridge/repo";
import type { GitignoreTemplate } from "../lib/bridge/types";
import { useI18n } from "../lib/i18n";
import { joinFolderPath } from "../lib/paths";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Create (init) repository dialog (OG-086): destination, initial branch, an
 * optional `.gitignore` template and an optional first commit. On success the
 * new repository opens in a tab.
 */
export function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [template, setTemplate] = useState("");
  const [initialCommit, setInitialCommit] = useState(true);
  const [templates, setTemplates] = useState<GitignoreTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    void gitignoreTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const canSubmit = parent !== "" && name.trim() !== "" && branch.trim() !== "" && !busy;

  const chooseParent = async () => {
    try {
      const picked = await pickDirectory();
      if (picked !== null) {
        setParent(picked);
      }
    } catch (pickError) {
      setError(formatGitError(pickError));
    }
  };

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    const destination = joinFolderPath(parent, name.trim());
    try {
      await initRepo(destination, branch.trim(), template === "" ? null : template, initialCommit);
      await useRepoStore.getState().open(destination);
      onClose();
    } catch (initError) {
      setError(formatGitError(initError));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={t("create.aria")}>
        <h2 className="remote-dialog-title">{t("create.title")}</h2>

        <div className="remote-field">
          <span>{t("common.parentFolder")}</span>
          <input aria-label={t("common.parentFolderAria")} readOnly value={parent} autoFocus />
          <button type="button" onClick={() => void chooseParent()}>
            {t("common.choose")}
          </button>
        </div>

        <label className="remote-field">
          <span>{t("common.folderName")}</span>
          <input
            aria-label={t("common.folderNameAria")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="remote-field">
          <span>{t("create.initialBranch")}</span>
          <input
            aria-label={t("create.initialBranchAria")}
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        </label>

        {parent !== "" && name.trim() !== "" && (
          <p className="remote-url">
            {t("create.at", { path: joinFolderPath(parent, name.trim()) })}
          </p>
        )}

        <fieldset className="remote-options">
          <legend>{t("common.options")}</legend>
          <label className="remote-field">
            <span>{t("create.gitignore")}</span>
            <select
              aria-label={t("create.gitignoreAria")}
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
            >
              <option value="">{t("create.none")}</option>
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={initialCommit}
              onChange={(event) => setInitialCommit(event.target.checked)}
            />
            {t("create.initialCommit")}
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}

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
            {t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
