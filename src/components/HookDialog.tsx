import { useEffect, useState } from "react";
import { formatGitError } from "../lib/bridge/errors";
import { hookRead, hookSetEnabled, hookWrite } from "../lib/bridge/hooks";
import type { Hook } from "../lib/bridge/types";
import { useHooksStore } from "../lib/stores/hooks";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/** Edits and enables/disables a repository hook (OG-098). */
export function HookDialog({ hook, onClose }: { hook: Hook; onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const [content, setContent] = useState("");
  const [state, setState] = useState(hook);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!root) {
      return;
    }
    hookRead(root, hook.name)
      .then((text) => {
        if (active) {
          setContent(text);
        }
      })
      .catch((err) => {
        if (active) {
          setError(formatGitError(err));
        }
      });
    return () => {
      active = false;
    };
  }, [root, hook.name]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const refresh = async () => {
    if (root) {
      await useHooksStore.getState().refresh(root);
    }
  };

  const save = async () => {
    if (!root || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await hookWrite(root, state.name, content);
      await refresh();
      useUiStore.getState().appendOutput(`Saved hook ${state.name}`);
      onClose();
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!root || busy) {
      return;
    }
    const enabling = !state.active;
    setBusy(true);
    setError(null);
    try {
      await hookSetEnabled(root, state.name, enabling);
      await refresh();
      useUiStore.getState().appendOutput(`${enabling ? "Enabled" : "Disabled"} hook ${state.name}`);
      setState((previous) => ({
        ...previous,
        installed: true,
        active: enabling,
        disabled: !enabling,
      }));
      setBusy(false);
    } catch (err) {
      setError(formatGitError(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="remote-dialog hook-dialog" role="dialog" aria-modal="true" aria-label="Hook">
        <h2 className="remote-dialog-title">{state.name}</h2>
        <p className="remote-dialog-subtitle">
          {state.active ? "Active" : state.sample && !state.installed ? "Sample" : "Disabled"}
        </p>

        <textarea
          className="settings-template hook-editor"
          aria-label="Hook contents"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        {error && (
          <p role="alert" className="refs-error">
            {error}
          </p>
        )}

        <div className="remote-dialog-actions">
          <button type="button" onClick={() => void toggle()} disabled={busy}>
            {state.active ? "Disable" : "Enable"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
