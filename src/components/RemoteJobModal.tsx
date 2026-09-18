import { useEffect, useState } from "react";
import { useRemoteStore } from "../lib/stores/remote";

/** Último porcentaje que git escribe en su progreso ("Receiving objects: 42%"). */
function lastPercent(lines: string[]): number | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index].match(/(\d{1,3})%/);
    if (match) {
      return Math.min(Number.parseInt(match[1], 10), 100);
    }
  }
  return null;
}

/**
 * Ventana de progreso y de error de los jobs de red, como SourceTree: mientras
 * corre enseña la barra y la última línea; si falla, la salida completa y Close.
 */
export function RemoteJobModal() {
  const running = useRemoteStore((state) => state.running);
  const title = useRemoteStore((state) => state.title);
  const error = useRemoteStore((state) => state.error);
  const recentLines = useRemoteStore((state) => state.recentLines);
  const cancel = useRemoteStore((state) => state.cancel);
  const dismiss = useRemoteStore((state) => state.dismiss);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    if (running) {
      setShowOutput(false);
    }
  }, [running]);

  if (!running && !error) {
    return null;
  }

  const percent = running ? lastPercent(recentLines) : null;
  const heading = title ?? "Remote operation";

  if (running) {
    return (
      <div className="modal-overlay">
        <div className="remote-dialog" role="dialog" aria-modal="true" aria-label={heading}>
          <h2 className="remote-dialog-title">{heading}</h2>
          <div
            className={`remote-progress${percent === null ? " indeterminate" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <div
              className="remote-progress-fill"
              style={percent !== null ? { width: `${percent}%` } : undefined}
            />
          </div>
          {!showOutput && recentLines.length > 0 && (
            <p className="remote-job-line">{recentLines[recentLines.length - 1]}</p>
          )}
          {showOutput && <pre className="remote-job-output">{recentLines.join("\n")}</pre>}
          <div className="remote-dialog-actions">
            <button type="button" onClick={() => void cancel()}>
              Cancel
            </button>
            <button
              type="button"
              aria-expanded={showOutput}
              onClick={() => setShowOutput(!showOutput)}
            >
              {showOutput ? "Hide Full Output" : "Show Full Output"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div
        className="remote-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${heading} failed`}
      >
        <h2 className="remote-dialog-title">Error</h2>
        <p className="remote-job-error" role="alert">
          {error}
        </p>
        <pre className="remote-job-output">{recentLines.join("\n")}</pre>
        <div className="remote-dialog-actions">
          <button type="button" className="primary" onClick={dismiss}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
