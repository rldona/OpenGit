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
      <div className="update-dialog" role="dialog" aria-modal="true" aria-label="Software Update">
        <div className="update-dialog-icon">
          <Icon name="download" size={28} />
        </div>

        {status === "checking" && (
          <>
            <h2 className="update-dialog-title">Checking for updates…</h2>
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                Close
              </button>
            </div>
          </>
        )}

        {status === "downloading" && (
          <>
            <h2 className="update-dialog-title">OpenGit {version} is available.</h2>
            <p className="update-dialog-text">
              Downloading the update…{percent(progress) ? ` ${percent(progress)}` : ""}
            </p>
            <progress
              className="update-dialog-progress"
              max={1}
              value={progress ?? undefined}
              aria-label="Download progress"
            />
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                Continue in background
              </button>
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <h2 className="update-dialog-title">OpenGit {version} is ready.</h2>
            <p className="update-dialog-text">Restart to install the update.</p>
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                Later
              </button>
              <button type="button" className="primary" onClick={() => void restart()}>
                Restart now
              </button>
            </div>
          </>
        )}

        {status === "up-to-date" && (
          <>
            <h2 className="update-dialog-title">OpenGit is up to date.</h2>
            <div className="update-dialog-actions">
              <button type="button" className="primary" onClick={dismiss}>
                OK
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <h2 className="update-dialog-title">Could not check for updates.</h2>
            {detail && <p className="update-dialog-text">{detail}</p>}
            <div className="update-dialog-actions">
              <button type="button" onClick={dismiss}>
                Close
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void check({ manual: true })}
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
