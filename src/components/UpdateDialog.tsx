import { useI18n } from "../lib/i18n";
import { useUpdateStore } from "../lib/stores/update";
import { Icon } from "./Icon";

function percent(progress: number | null): string | null {
  return progress === null ? null : `${Math.round(progress * 100)}%`;
}

/**
 * In-app update dialog (OG-081, ADR-0007). Automatic checks only surface a
 * downloaded update; manual checks show checking, up-to-date and error states.
 */
export function UpdateDialog() {
  const { t } = useI18n();
  const status = useUpdateStore((state) => state.status);
  const version = useUpdateStore((state) => state.version);
  const progress = useUpdateStore((state) => state.progress);
  const detail = useUpdateStore((state) => state.detail);
  const check = useUpdateStore((state) => state.check);
  const restart = useUpdateStore((state) => state.restart);
  const dismiss = useUpdateStore((state) => state.dismiss);

  if (status === "idle") {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="update-dialog" role="dialog" aria-modal="true" aria-label={t("update.aria")}>
        <div className="update-dialog-icon">
          <Icon name="download" size={28} />
        </div>

        {status === "checking" && (
          <>
            <h2 className="update-dialog-title">{t("update.checking")}</h2>
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                {t("common.close")}
              </button>
            </div>
          </>
        )}

        {status === "downloading" && (
          <>
            <h2 className="update-dialog-title">
              {t("update.available", { version: version ?? "" })}
            </h2>
            <p className="update-dialog-text">
              {t("update.downloading")}
              {percent(progress) ? ` ${percent(progress)}` : ""}
            </p>
            <progress
              className="update-dialog-progress"
              max={1}
              value={progress ?? undefined}
              aria-label={t("update.downloadProgressAria")}
            />
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                {t("update.continueBackground")}
              </button>
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <h2 className="update-dialog-title">{t("update.ready", { version: version ?? "" })}</h2>
            <p className="update-dialog-text">{t("update.restartToInstall")}</p>
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                {t("update.later")}
              </button>
              <button type="button" className="primary" onClick={() => void restart()}>
                {t("update.restartNow")}
              </button>
            </div>
          </>
        )}

        {status === "up-to-date" && (
          <>
            <h2 className="update-dialog-title">{t("update.upToDate")}</h2>
            <div className="update-dialog-actions">
              <button type="button" className="primary" onClick={dismiss}>
                {t("common.ok")}
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <h2 className="update-dialog-title">{t("update.errorTitle")}</h2>
            {detail && <p className="update-dialog-text">{detail}</p>}
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                {t("common.close")}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void check({ manual: true })}
              >
                {t("update.retry")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
