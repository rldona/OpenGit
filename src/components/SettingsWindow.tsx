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
  gpgSecretKeys,
  ignoreExcludePath,
  openPath,
  readTextFile,
} from "../lib/bridge/settings";
import type { GpgKey } from "../lib/bridge/types";
import { formatCommitDate } from "../lib/format";
import { useI18n, type MessageKey } from "../lib/i18n";
import type { Locale } from "../lib/i18n/locale";
import { syncStoredSession } from "../lib/tabs";
import { useExtrasStore } from "../lib/stores/extras";
import { useLocaleStore } from "../lib/stores/locale";
import { usePaletteStore } from "../lib/stores/palette";
import { useRepoStore } from "../lib/stores/repo";
import { useSettingsStore } from "../lib/stores/settings";
import { useThemeStore } from "../lib/stores/theme";
import type { PaletteName, ThemePreference } from "../lib/theme";
import { Icon, type IconName } from "./Icon";

type Tab = "general" | "advanced" | "remotes" | "security" | "template" | "appearance";
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
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const autoRefresh = useSettingsStore((state) => state.autoRefresh);
  const setAutoRefresh = useSettingsStore((state) => state.setAutoRefresh);
  const theme = useThemeStore((state) => state.preference);
  const setTheme = useThemeStore((state) => state.setPreference);
  const palette = usePaletteStore((state) => state.palette);
  const setPalette = usePaletteStore((state) => state.setPalette);
  const restoreTabs = useSettingsStore((state) => state.restoreTabs);
  const setRestoreTabs = useSettingsStore((state) => state.setRestoreTabs);
  const localePreference = useLocaleStore((state) => state.preference);
  const setLocalePreference = useLocaleStore((state) => state.setPreference);

  const remotes = useExtrasStore((state) => state.remotes);
  const tabs: Array<{ id: Tab; labelKey: MessageKey; icon: IconName }> = [
    { id: "general", labelKey: "settings.tabGeneral", icon: "workspace" },
    ...(root
      ? [
          {
            id: "advanced" as const,
            labelKey: "settings.tabAdvanced" as const,
            icon: "settings" as const,
          },
        ]
      : []),
    ...(root
      ? [
          {
            id: "remotes" as const,
            labelKey: "settings.tabRemotes" as const,
            icon: "cloud" as const,
          },
        ]
      : []),
    ...(root
      ? [
          {
            id: "security" as const,
            labelKey: "settings.tabSecurity" as const,
            icon: "lock" as const,
          },
        ]
      : []),
    ...(root
      ? [
          {
            id: "template" as const,
            labelKey: "settings.tabTemplate" as const,
            icon: "file" as const,
          },
        ]
      : []),
    { id: "appearance", labelKey: "settings.tabAppearance", icon: "theme" },
  ];
  const [tab, setTab] = useState<Tab>(root ? "advanced" : "appearance");

  const [draftTheme, setDraftTheme] = useState<ThemePreference>(theme);
  const [draftPalette, setDraftPalette] = useState<PaletteName>(palette);
  const [draftLocale, setDraftLocale] = useState<"system" | Locale>(localePreference ?? "system");
  const [draftAutoRefresh, setDraftAutoRefresh] = useState(autoRefresh);
  const [draftRestoreTabs, setDraftRestoreTabs] = useState(restoreTabs);
  const [ignorePath, setIgnorePath] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<{ name: string; url: string } | null>(null);
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [templateMode, setTemplateMode] = useState<TemplateMode>("none");
  const [templateContent, setTemplateContent] = useState("");
  const [templateGlobalSet, setTemplateGlobalSet] = useState(false);
  const [signEnabled, setSignEnabled] = useState(false);
  const [signingKey, setSigningKey] = useState("");
  const [gpgKeys, setGpgKeys] = useState<GpgKey[]>([]);
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
    void Promise.all([
      configGet(root, "commit.gpgsign", "local"),
      configGet(root, "user.signingkey", "local"),
      gpgSecretKeys(),
    ])
      .then(([sign, key, keys]) => {
        setSignEnabled(sign === "true");
        setSigningKey(key ?? "");
        setGpgKeys(keys);
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
      setError(t("settings.remoteRequired"));
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
      t("settings.remoteRemoveConfirm", { name: selectedRemote }),
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
    const file = await pickFile(t("settings.importTemplateTitle"));
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
        if (signEnabled) {
          await configSet(root, "commit.gpgsign", "true", "local");
          if (signingKey !== "") {
            await configSet(root, "user.signingkey", signingKey, "local");
          }
        } else {
          await configUnset(root, "commit.gpgsign", "local");
          await configUnset(root, "user.signingkey", "local");
        }
      }
      if (draftAutoRefresh !== autoRefresh) {
        setAutoRefresh(draftAutoRefresh);
      }
      if (draftRestoreTabs !== restoreTabs) {
        setRestoreTabs(draftRestoreTabs);
        syncStoredSession(
          draftRestoreTabs,
          useRepoStore.getState().openTabs,
          useRepoStore.getState().repo?.root ?? null,
        );
      }
      if (draftLocale !== (localePreference ?? "system")) {
        setLocalePreference(draftLocale === "system" ? null : draftLocale);
      }
      setTheme(draftTheme);
      setPalette(draftPalette);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const shownName = user?.useGlobal ? user.globalName : (user?.localName ?? "");
  const shownEmail = user?.useGlobal ? user.globalEmail : (user?.localEmail ?? "");
  const selectedKey = gpgKeys.find((key) => key.id === signingKey) ?? null;

  return (
    <div className="modal-overlay">
      <div
        className="settings-window"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.aria")}
      >
        <header className="settings-header">
          <h2 className="settings-title">{t(active.labelKey)}</h2>
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
                <span>{t(item.labelKey)}</span>
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

          {tab === "general" && (
            <section className="settings-section">
              <h3>{t("settings.startup")}</h3>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={draftRestoreTabs}
                  onChange={(event) => setDraftRestoreTabs(event.target.checked)}
                />
                {t("settings.restoreTabs")}
              </label>
            </section>
          )}

          {tab === "advanced" && root && user && (
            <>
              <section className="settings-section">
                <h3>{t("settings.ignoreTitle")}</h3>
                <div className="settings-row">
                  <input
                    className="settings-input"
                    aria-label={t("settings.ignoreAria")}
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
                    {t("settings.edit")}
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <h3>{t("settings.userInfo")}</h3>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={user.useGlobal}
                    onChange={(event) => setUser({ ...user, useGlobal: event.target.checked })}
                  />
                  {t("settings.useGlobal")}
                </label>
                <label className="settings-field">
                  <span>{t("settings.fullName")}</span>
                  <input
                    aria-label={t("settings.fullNameAria")}
                    value={shownName}
                    disabled={user.useGlobal}
                    onChange={(event) => setUser({ ...user, localName: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span>{t("settings.email")}</span>
                  <input
                    aria-label={t("settings.emailAria")}
                    value={shownEmail}
                    disabled={user.useGlobal}
                    onChange={(event) => setUser({ ...user, localEmail: event.target.value })}
                  />
                </label>
              </section>

              <section className="settings-section">
                <h3>{t("settings.misc")}</h3>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={draftAutoRefresh}
                    onChange={(event) => setDraftAutoRefresh(event.target.checked)}
                  />
                  {t("settings.autoRefresh")}
                </label>
              </section>
            </>
          )}

          {tab === "remotes" && root && (
            <section className="settings-section">
              <h3>{t("settings.remotesTitle")}</h3>
              <div className="remotes-table" aria-label={t("settings.remotesAria")}>
                <div className="remotes-head">
                  <span>{t("settings.nameColumn")}</span>
                  <span>{t("settings.pathColumn")}</span>
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
                {remotes.length === 0 && <p className="muted">{t("settings.noRemotes")}</p>}
              </div>

              {remoteDraft && (
                <div className="remotes-form">
                  <label className="settings-field">
                    <span>{t("settings.nameLabel")}</span>
                    <input
                      aria-label={t("settings.nameAria")}
                      value={remoteDraft.name}
                      onChange={(event) =>
                        setRemoteDraft({ ...remoteDraft, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t("settings.pathLabel")}</span>
                    <input
                      aria-label={t("settings.urlAria")}
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
                      {t("common.cancel")}
                    </button>
                    <button type="button" className="primary" onClick={() => void saveRemote()}>
                      {t("common.save")}
                    </button>
                  </div>
                </div>
              )}

              <div className="remotes-actions">
                <button type="button" onClick={startAddRemote}>
                  {t("settings.add")}
                </button>
                <button type="button" disabled={selectedRemote === null} onClick={startEditRemote}>
                  {t("settings.edit")}
                </button>
                <button
                  type="button"
                  disabled={selectedRemote === null}
                  onClick={() => void removeRemote()}
                >
                  {t("settings.remove")}
                </button>
              </div>
            </section>
          )}

          {tab === "security" && root && (
            <section className="settings-section">
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={signEnabled}
                  onChange={(event) => setSignEnabled(event.target.checked)}
                />
                {t("settings.enableSigning")}
              </label>
              <label className="settings-field">
                <span>{t("settings.keyLabel")}</span>
                <select
                  aria-label={t("settings.keyAria")}
                  value={signingKey}
                  disabled={!signEnabled || gpgKeys.length === 0}
                  onChange={(event) => setSigningKey(event.target.value)}
                >
                  <option value="">{t("settings.selectKey")}</option>
                  {gpgKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.user || key.id}
                    </option>
                  ))}
                </select>
              </label>
              {gpgKeys.length === 0 && <p className="muted">{t("settings.noKeys")}</p>}

              <div className="settings-key">
                <h3>{t("settings.signingTitle")}</h3>
                <dl>
                  <div>
                    <dt>{t("settings.user")}</dt>
                    <dd>{selectedKey?.user || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("settings.type")}</dt>
                    <dd>{selectedKey?.algo || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("settings.keyField")}</dt>
                    <dd className="settings-key-fingerprint">{selectedKey?.fingerprint || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("settings.created")}</dt>
                    <dd>{selectedKey?.created ? formatCommitDate(selectedKey.created) : "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("settings.expires")}</dt>
                    <dd>{selectedKey?.expires ? formatCommitDate(selectedKey.expires) : "—"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          )}

          {tab === "template" && root && (
            <section className="settings-section">
              <p className="settings-help">{t("settings.templateHelp")}</p>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "none"}
                  onChange={() => setTemplateMode("none")}
                />
                {t("settings.templateNone")}
              </label>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "default"}
                  onChange={() => setTemplateMode("default")}
                />
                {t("settings.templateDefault")}
                {!templateGlobalSet && (
                  <span className="muted">{t("settings.templateNoGlobal")}</span>
                )}
              </label>
              <label className="settings-check">
                <input
                  type="radio"
                  name="template-mode"
                  checked={templateMode === "custom"}
                  onChange={() => setTemplateMode("custom")}
                />
                {t("settings.templateCustom")}
              </label>
              <textarea
                className="settings-template"
                aria-label={t("settings.templateAria")}
                value={templateContent}
                disabled={templateMode !== "custom"}
                onChange={(event) => setTemplateContent(event.target.value)}
              />
              <div className="remote-dialog-actions">
                <button type="button" onClick={() => void importTemplate()}>
                  {t("settings.importTemplate")}
                </button>
              </div>
            </section>
          )}

          {tab === "appearance" && (
            <section className="settings-section">
              <h3>{t("settings.theme")}</h3>
              <label className="settings-field">
                <span>{t("settings.appearance")}</span>
                <select
                  aria-label={t("settings.themeAria")}
                  value={draftTheme}
                  onChange={(event) => setDraftTheme(event.target.value as ThemePreference)}
                >
                  <option value="system">{t("settings.themeSystem")}</option>
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                </select>
              </label>

              <h3>{t("settings.palette")}</h3>
              <label className="settings-field">
                <span>{t("settings.paletteLabel")}</span>
                <select
                  aria-label={t("settings.paletteAria")}
                  value={draftPalette}
                  onChange={(event) => setDraftPalette(event.target.value as PaletteName)}
                >
                  <option value="default">{t("settings.paletteDefault")}</option>
                  <option value="purple">{t("settings.palettePurple")}</option>
                  <option value="classic">{t("settings.paletteClassic")}</option>
                  <option value="sublime">{t("settings.paletteSublime")}</option>
                  <option value="sublime-dark">{t("settings.paletteSublimeDark")}</option>
                  <option value="github">{t("settings.paletteGithub")}</option>
                  <option value="copilot">{t("settings.paletteCopilot")}</option>
                  <option value="vercel">{t("settings.paletteVercel")}</option>
                  <option value="code">{t("settings.paletteCode")}</option>
                </select>
              </label>

              <h3>{t("settings.language")}</h3>
              <label className="settings-field">
                <span>{t("settings.language")}:</span>
                <select
                  aria-label={t("settings.language")}
                  value={draftLocale}
                  onChange={(event) => setDraftLocale(event.target.value as "system" | Locale)}
                >
                  <option value="system">{t("settings.languageSystem")}</option>
                  <option value="en">{t("settings.languageEnglish")}</option>
                  <option value="es">{t("settings.languageSpanish")}</option>
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
              {t("settings.editConfig")}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>
            {t("common.ok")}
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
