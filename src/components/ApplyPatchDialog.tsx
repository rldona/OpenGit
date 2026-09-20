import { useEffect, useState } from "react";
import { pickFile } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { applyPatch } from "../lib/bridge/patch";
import { useI18n } from "../lib/i18n";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/**
 * Apply patch dialog (OG-094): a mailbox patch (`git am`) or a plain diff
 * (`git apply`), optionally three-way, with the result in the Output panel.
 */
export function ApplyPatchDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [file, setFile] = useState("");
  const [mailbox, setMailbox] = useState(true);
  const [threeWay, setThreeWay] = useState(false);
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

  const chooseFile = async () => {
    try {
      const picked = await pickFile(t("patch.chooseTitle"));
      if (picked !== null) {
        setFile(picked);
      }
    } catch (pickError) {
      setError(formatGitError(pickError));
    }
  };

  const submit = async () => {
    if (root === null || file === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const output = await applyPatch(root, file, mailbox, threeWay);
      const trimmed = output.trim();
      useUiStore.getState().appendOutput(trimmed === "" ? t("patch.applied", { file }) : trimmed);
      onClose();
    } catch (applyError) {
      setError(formatGitError(applyError));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={t("patch.aria")}>
        <h2 className="remote-dialog-title">{t("patch.title")}</h2>

        <div className="remote-field">
          <span>{t("patch.file")}</span>
          <input aria-label={t("patch.fileAria")} readOnly value={file} autoFocus />
          <button type="button" onClick={() => void chooseFile()}>
            {t("common.choose")}
          </button>
        </div>

        <fieldset className="remote-options">
          <legend>{t("common.options")}</legend>
          <label>
            <input
              type="checkbox"
              checked={mailbox}
              onChange={(event) => setMailbox(event.target.checked)}
            />
            {t("patch.mailbox")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={threeWay}
              onChange={(event) => setThreeWay(event.target.checked)}
            />
            {t("patch.threeWay")}
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
            disabled={file === "" || busy}
            onClick={() => void submit()}
          >
            {t("patch.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
