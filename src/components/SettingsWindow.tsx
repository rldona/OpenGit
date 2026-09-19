import { useEffect, useState } from "react";
import { confirmDestructive, pickFile } from "../lib/bridge/dialog";
import {
  gitConfigPath,
  remoteAdd,
  remoteRemove,
  remoteRename,
  remoteSetUrl,
} from "../lib/bridge/repo";
import {
  commitTemplateRead,
  commitTemplateWrite,
  configGet,
  configSet,
  configUnset,
  ignoreExcludePath,
  openPath,
  readTextFile,
} from "../lib/bridge/settings";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { useSettingsStore } from "../lib/stores/settings";
import { useThemeStore } from "../lib/stores/theme";
import type { ThemePreference } from "../lib/theme";
import { Icon, type IconName } from "./Icon";

type Tab = "advanced" | "remotes" | "template" | "appearance";
type TemplateMode = "none" | "default" | "custom";

type UserInfo = {
  /** Use the global identity instead of a repository-local one. */
  useGlobal: boolean;
  localName: string;
  localEmail: string;
  globalName: string;
  globalEmail: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Settings modal (OG-067), SourceTree-style: title and tabs in the header, the
 * tab body and Cancel/OK. Only the tabs implemented so far are shown; Remotes,
 * Security and Commit Template land in follow-ups, in that order.
 */
export function SettingsWindow({ onClose }: { onClose: () => void }) {
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const autoRefresh = useSettingsStore((state) => state.autoRefresh);
  const setAutoRefresh = useSettingsStore((state) => state.setAutoRefresh);
  const theme = useThemeStore((state) => state.preference);
  const setTheme = useThemeStore((state) => state.setPreference);

  const remotes = useExtrasStore((state) => state.remotes);
  const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
    ...(root ? [{ id: "advanced" as const, label: "Advanced", icon: "settings" as const }] : []),
    ...(root ? [{ id: "remotes" as const, label: "Remotes", icon: "cloud" as const }] : []),
    ...(root ? [{ id: "template" as const, label: "Commit Template", icon: "file" as const }] : []),
    { id: "appearance", label: "Appearance", icon: "theme" },
  ];
  const [tab, setTab] = useState<Tab>(root ? "advanced" : "appearance");

  const [draftTheme, setDraftTheme] = useState<ThemePreference>(theme);
  const [draftAutoRefresh, setDraftAutoRefresh] = useState(autoRefresh);
  const [ignorePath, setIgnorePath] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<{ name: string; url: string } | null>(null);
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("none");
  const [templateContent, setTemplateContent] = useState("");
  const [templateGlobalSet, setTemplateGlobalSet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) {
      return;
    }
    void ignoreExcludePath(root)
      .then(setIgnorePath)
      .catch(() => setIgnorePath(""));
    void Promise.all([
      configGet(root, "user.name", "local"),
      configGet(root, "user.email", "local"),
      configGet(root, "user.name", "global"),
      configGet(root, "user.email", "global"),
    ])
      .then(([localName, localEmail, globalName, globalEmail]) =>
        setUser({
          useGlobal: localName === null && localEmail === null,
          localName: localName ?? "",
          localEmail: localEmail ?? "",
          globalName: globalName ?? "",
          globalEmail: globalEmail ?? "",
        }),
      )
      .catch((err: unknown) => setError(errorMessage(err)));
    void Promise.all([
      configGet(root, "commit.template", "local"),
      configGet(root, "commit.template", "global"),
      commitTemplateRead(root),
    ])
      .then(([localTemplate, globalTemplate, content]) => {
        setTemplateGlobalSet(globalTemplate !== null);
        setTemplateMode(
          localTemplate !== null ? "custom" : globalTemplate !== null ? "default" : "none",
        );
        setTemplateContent(content);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [root]);

  useEffect(() => {
    if (root) {
      void useExtrasStore.getState().refresh(root);
    }
  }, [root]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  const startAddRemote = () => {
    setRemoteDraft({ name: "", url: "" });
    setEditingRemote(null);
  };

  const startEditRemote = () => {
    const remote = remotes.find((item) => item.name === selectedRemote);
    if (!remote) {
      return;
    }
    setRemoteDraft({ name: remote.name, url: remote.url });
    setEditingRemote(remote.name);
  };

  const saveRemote = async () => {
    if (!root || !remoteDraft) {
      return;
    }
    const name = remoteDraft.name.trim();
    const url = remoteDraft.url.trim();
    if (name === "" || url === "") {
      setError("Remote name and URL are required");
      return;
    }
    setError(null);
    try {
      if (editingRemote === null) {
        await remoteAdd(root, name, url);
      } else {
        if (name !== editingRemote) {
          await remoteRename(root, editingRemote, name);
        }
        await remoteSetUrl(root, name, url);
      }
      await useExtrasStore.getState().refresh(root);
      setSelectedRemote(name);
      setRemoteDraft(null);
      setEditingRemote(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeRemote = async () => {
    if (!root || selectedRemote === null) {
      return;
    }
    const confirmed = await confirmDestructive(
      `Remove remote ${selectedRemote}? Its remote branches disappear from the repo.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await remoteRemove(root, selectedRemote);
      await useExtrasStore.getState().refresh(root);
      setSelectedRemote(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const editConfigFile = async () => {
    if (!root) {
      return;
    }
    try {
      await openPath(await gitConfigPath(root));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const importTemplate = async () => {
    const file = await pickFile("Import commit template");
    if (file === null) {
      return;
    }
    try {
      setTemplateContent(await readTextFile(file));
      setTemplateMode("custom");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (root && user) {
        if (user.useGlobal) {
          await configUnset(root, "user.name", "local");
          await configUnset(root, "user.email", "local");
        } else {
          await setLocal(root, "user.name", user.localName);
          await setLocal(root, "user.email", user.localEmail);
        }
      }
      if (root) {
        if (templateMode === "custom") {
          await commitTemplateWrite(root, templateContent);
        } else {
          await configUnset(root, "commit.template", "local");
        }
      }
      if (draftAutoRefresh !== autoRefresh) {
        setAutoRefresh(draftAutoRefresh);
      }
      setTheme(draftTheme);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const shownName = user?.useGlobal ? user.globalName : (user?.localName ?? "");
  const shownEmail = user?.useGlobal ? user.globalEmail : (user?.localEmail ?? "");

  return (
    <div className="modal-overlay">
      <div className="settings-window" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="settings-header">
          <h2 className="settings-title">{active.label}</h2>
          <div className="settings-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`settings-tab${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="settings-body">
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}

          {tab === "advanced" && root && user && (
            <>
              <section className="settings-section">
                <h3>Repository-specific ignore list</h3>
                <div className="settings-row">
                  <input
                    className="settings-input"
                    aria-label="Ignore file"
                    readOnly
                    value={ignorePath}
                  />
                  <button
                    type="button"
                    disabled={ignorePath === ""}
                    onClick={() =>
                      void openPath(ignorePath).catch((err) => setError(errorMessage(err)))
                    }
                  >
                    Edit
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <h3>User information</h3>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={user.useGlobal}
                    onChange={(event) => setUser({ ...user, useGlobal: event.target.checked })}
                  />
                  Use global user settings
                </label>
                <label className="settings-field">
                  <span>Full Name:</span>
                  <input
                    aria-label="Full Name"
                    value={shownName}
                    disabled={user.useGlobal}
                    onChange={(event) => setUser({ ...user, localName: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span>Email address:</span>
                  <input
                    aria-label="Email address"
                    value={shownEmail}
                    disabled={user.useGlobal}
                    onChange={(event) => setUser({ ...user, localEmail: event.target.value })}
                  />
                </label>
              </section>

              <section className="settings-section">
                <h3>Miscellaneous</h3>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={draftAutoRefresh}
                    onChange={(event) => setDraftAutoRefresh(event.target.checked)}
                  />
                  Automatically refresh (if disabled you must manually refresh this repository)
                </label>
              </section>
            </>
          )}

          {tab === "remotes" && root && (
            <section className="settings-section">
              <h3>Remote repository paths</h3>
              <div className="remotes-table" aria-label="Remotes">
                <div className="remotes-head">
                  <span>Name</span>
                  <span>Path</span>
                </div>
                {remotes.map((remote) => (
                  <button
                    key={remote.name}
                    type="button"
                    className={`remotes-row${selectedRemote === remote.name ? " selected" : ""}`}
                    onClick={() => setSelectedRemote(remote.name)}
                  >
                    <span>{remote.name}</span>
                    <span className="remotes-url">{remote.url}</span>
                  </button>
                ))}
                {remotes.length === 0 && <p className="muted">No remotes</p>}
              </div>

              {remoteDraft && (
                <div className="remotes-form">
                  <label className="settings-field">
                    <span>Name:</span>
                    <input
                      aria-label="Remote name"
                      value={remoteDraft.name}
                      onChange={(event) =>
                        setRemoteDraft({ ...remoteDraft, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>Path:</span>
                    <input
                      aria-label="Remote URL"
                      value={remoteDraft.url}
                      onChange={(event) =>
                        setRemoteDraft({ ...remoteDraft, url: event.target.value })
                      }
                    />
                  </label>
                  <div className="remote-dialog-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setRemoteDraft(null);
                        setEditingRemote(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={() => void saveRemote()}>
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="remotes-actions">
                <button type="button" onClick={startAddRemote}>
                  Add
                </button>
                <button type="button" disabled={selectedRemote === null} onClick={startEditRemote}>
                  Edit
                </button>
                <button
                  type="button"
                  disabled={selectedRemote === null}
                  onClick={() => void removeRemote()}
                >
                  Remove
                </button>
              </div>
            </section>
          )}

          {tab === "template" && root && (
            <section className="settings-section">
              <p className="settings-help">
                This message template is a customizable text block that automatically populates the
                message editor for this repository.
              </p>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "none"}
                  onChange={() => setTemplateMode("none")}
                />
                None
              </label>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "default"}
                  onChange={() => setTemplateMode("default")}
                />
                Default (Preferences → Commit Template)
                {!templateGlobalSet && <span className="muted"> — no global template set</span>}
              </label>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "custom"}
                  onChange={() => setTemplateMode("custom")}
                />
                Custom (This Repository Only)
              </label>
              <textarea
                className="settings-template"
                aria-label="Commit template"
                value={templateContent}
                disabled={templateMode !== "custom"}
                onChange={(event) => setTemplateContent(event.target.value)}
              />
              <div className="remote-dialog-actions">
                <button type="button" onClick={() => void importTemplate()}>
                  Import…
                </button>
              </div>
            </section>
          )}

          {tab === "appearance" && (
            <section className="settings-section">
              <h3>Theme</h3>
              <label className="settings-field">
                <span>Appearance:</span>
                <select
                  aria-label="Theme"
                  value={draftTheme}
                  onChange={(event) => setDraftTheme(event.target.value as ThemePreference)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </section>
          )}
        </div>

        <footer className="remote-dialog-actions settings-footer">
          {tab === "remotes" && root && (
            <button
              type="button"
              className="settings-footer-left"
              onClick={() => void editConfigFile()}
            >
              Edit Config File…
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            OK
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Writes a repository-local value; an empty one is removed instead. */
async function setLocal(root: string, key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed === "") {
    await configUnset(root, key, "local");
  } else {
    await configSet(root, key, trimmed, "local");
  }
}
