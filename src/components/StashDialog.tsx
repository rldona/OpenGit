import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useRepoStore } from "../lib/stores/repo";
import { useStashStore } from "../lib/stores/stash";

/** Saves the working tree changes as a stash, in a modal (OG-016). */
export function StashDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const create = useStashStore((state) => state.create);
  const error = useStashStore((state) => state.error);
  const [message, setMessage] = useState("");
  const [untracked, setUntracked] = useState(false);
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

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    setBusy(true);
    const ok = await create(root, message.trim() === "" ? null : message.trim(), untracked);
    if (ok) {
      onClose();
      return;
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay">
      <div
        className="remote-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("stash.dialogAria")}
      >
        <h2 className="remote-dialog-title">{t("stash.title")}</h2>
        <p className="remote-dialog-subtitle">{t("stash.subtitle")}</p>

        <label className="remote-field">
          <span>{t("stash.message")}</span>
          <input
            autoFocus
            aria-label={t("stash.messageAria")}
            placeholder={t("stash.messagePlaceholder")}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </label>

        <label className="refs-check">
          <input
            type="checkbox"
            checked={untracked}
            onChange={(event) => setUntracked(event.target.checked)}
          />
          {t("stash.includeUntracked")}
        </label>

        {error && (
          <p role="alert" className="refs-error">
            {error}
          </p>
        )}

        <div className="remote-dialog-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            {t("stash.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
