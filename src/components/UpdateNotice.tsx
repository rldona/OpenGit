import { useUpdateStore } from "../lib/stores/update";

/**
 * Non-blocking update notice (OG-077). Only renders for terminal check
 * states; automatic checks surface `available` and stay silent otherwise.
 */
export function UpdateNotice() {
  const status = useUpdateStore((state) => state.status);
  const version = useUpdateStore((state) => state.version);
  const detail = useUpdateStore((state) => state.detail);
  const openDownload = useUpdateStore((state) => state.openDownload);
  const check = useUpdateStore((state) => state.check);
  const dismiss = useUpdateStore((state) => state.dismiss);

  if (status === "idle" || status === "checking") {
    return null;
  }

  return (
    <div className="update-notice" role="status">
      {status === "available" && (
        <>
          <span>
            OpenGit {version} is available.{" "}
            <button type="button" className="update-action" onClick={() => void openDownload()}>
              Download
            </button>
          </span>
          <button type="button" className="update-dismiss" onClick={dismiss} aria-label="Later">
            Later
          </button>
        </>
      )}
      {status === "up-to-date" && (
        <>
          <span>OpenGit is up to date.</span>
          <button type="button" className="update-dismiss" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </>
      )}
      {status === "error" && (
        <>
          <span>
            Could not check for updates.{detail ? ` ${detail}` : ""}{" "}
            <button
              type="button"
              className="update-action"
              onClick={() => void check({ manual: true })}
            >
              Retry
            </button>
          </span>
          <button type="button" className="update-dismiss" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </>
      )}
    </div>
  );
}
