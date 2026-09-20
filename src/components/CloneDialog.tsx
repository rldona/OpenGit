import { useEffect, useRef, useState } from "react";
import { pickDirectory } from "../lib/bridge/dialog";
import { formatGitError } from "../lib/bridge/errors";
import { cloneFolderName } from "../lib/clone";
import { useI18n } from "../lib/i18n";
import { joinFolderPath } from "../lib/paths";
import { useRemoteStore } from "../lib/stores/remote";

/**
 * Clone dialog (OG-085): URL, destination and options. The clone runs as a
 * remote job, so the shared progress/error window takes over on OK and the
 * repository opens in a tab when it finishes.
 */
export function CloneDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const start = useRemoteStore((state) => state.start);
  const running = useRemoteStore((state) => state.running);

  const [url, setUrl] = useState("");
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [depth, setDepth] = useState("");
  const [branch, setBranch] = useState("");
  const [recurseSubmodules, setRecurseSubmodules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameTouched = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canSubmit = url.trim() !== "" && parent !== "" && name.trim() !== "" && !running;

  const changeUrl = (value: string) => {
    setUrl(value);
    if (!nameTouched.current) {
      setName(cloneFolderName(value));
    }
  };

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

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    const parsedDepth = depth.trim() === "" ? null : Number.parseInt(depth, 10);
    if (parsedDepth !== null && (!Number.isFinite(parsedDepth) || parsedDepth <= 0)) {
      setError(t("clone.depthError"));
      return;
    }
    void start(parent, {
      kind: "clone",
      url: url.trim(),
      destination: joinFolderPath(parent, name.trim()),
      depth: parsedDepth,
      branch: branch.trim() === "" ? null : branch.trim(),
      recurse_submodules: recurseSubmodules,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={t("clone.aria")}>
        <h2 className="remote-dialog-title">{t("clone.title")}</h2>

        <label className="remote-field">
          <span>{t("clone.url")}</span>
          <input
            aria-label={t("clone.urlAria")}
            value={url}
            autoFocus
            placeholder="https://github.com/user/repo.git"
            onChange={(event) => changeUrl(event.target.value)}
          />
        </label>

        <div className="remote-field">
          <span>{t("common.parentFolder")}</span>
          <input aria-label={t("common.parentFolderAria")} readOnly value={parent} />
          <button type="button" onClick={() => void chooseParent()}>
            {t("common.choose")}
          </button>
        </div>

        <label className="remote-field">
          <span>{t("common.folderName")}</span>
          <input
            aria-label={t("common.folderNameAria")}
            value={name}
            onChange={(event) => {
              nameTouched.current = true;
              setName(event.target.value);
            }}
          />
        </label>

        {parent !== "" && name.trim() !== "" && (
          <p className="remote-url">
            {t("clone.into", { path: joinFolderPath(parent, name.trim()) })}
          </p>
        )}

        <fieldset className="remote-options">
          <legend>{t("common.options")}</legend>
          <label className="remote-field">
            <span>{t("clone.depth")}</span>
            <input
              aria-label={t("clone.depthAria")}
              inputMode="numeric"
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
            />
          </label>
          <label className="remote-field">
            <span>{t("clone.branch")}</span>
            <input
              aria-label={t("clone.branchAria")}
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={recurseSubmodules}
              onChange={(event) => setRecurseSubmodules(event.target.checked)}
            />
            {t("clone.recurse")}
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
          <button type="button" className="primary" disabled={!canSubmit} onClick={submit}>
            {t("clone.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
