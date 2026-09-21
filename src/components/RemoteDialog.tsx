import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { remoteAdd, remoteRename, remoteSetUrl } from "../lib/bridge/repo";
import { useI18n } from "../lib/i18n";
import { useExtrasStore } from "../lib/stores/extras";
import { useRefsStore } from "../lib/stores/refs";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

export type RemoteDialogMode = "add" | "edit";
/** Which part of the remote can be changed (OG-056). */
export type RemoteDialogField = "both" | "name" | "url";

type Props = {
  mode: RemoteDialogMode;
  field?: RemoteDialogField;
  remote?: { name: string; url: string } | null;
  onClose: () => void;
};

/**
 * Add/edit remote dialog (OG-056). Editing can be limited to the name (rename)
 * or the URL, so the sidebar can offer both actions without two forms.
 */
export function RemoteDialog({ mode, field = "both", remote = null, onClose }: Props) {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [name, setName] = useState(remote?.name ?? "");
  const [url, setUrl] = useState(remote?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const nameReadOnly = mode === "edit" && field === "url";
  const urlReadOnly = mode === "edit" && field === "name";
  const title =
    mode === "add"
      ? t("remoteDialog.newRemote")
      : field === "name"
        ? t("remoteDialog.renameRemote")
        : t("remoteDialog.editUrl");

  const submit = async () => {
    if (!root || busy) {
      return;
    }
    const nextName = name.trim();
    const nextUrl = url.trim();
    if (!nameReadOnly && nextName === "") {
      setError(t("remoteDialog.nameRequired"));
      return;
    }
    if (!urlReadOnly && nextUrl === "") {
      setError(t("remoteDialog.urlRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "add") {
        await remoteAdd(root, nextName, nextUrl);
      } else if (remote) {
        if (!nameReadOnly && nextName !== remote.name) {
          await remoteRename(root, remote.name, nextName);
        }
        if (!urlReadOnly && nextUrl !== remote.url) {
          await remoteSetUrl(root, nameReadOnly ? remote.name : nextName, nextUrl);
        }
      }
      await Promise.all([
        useExtrasStore.getState().refresh(root),
        useRefsStore.getState().refresh(root),
      ]);
      useUiStore
        .getState()
        .appendOutput(
          mode === "add"
            ? t("remoteDialog.added", { name: nextName })
            : t("remoteDialog.updated", { name: remote?.name ?? "" }),
        );
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="remote-dialog-title">{title}</h2>

        <label className="remote-field">
          <span>{t("common.name")}</span>
          <input
            aria-label={t("remoteDialog.nameAria")}
            value={name}
            readOnly={nameReadOnly}
            autoFocus={!nameReadOnly}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </label>

        <label className="remote-field">
          <span>{t("common.url")}</span>
          <input
            aria-label={t("remoteDialog.urlAria")}
            value={url}
            readOnly={urlReadOnly}
            autoFocus={nameReadOnly}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
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
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
