import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive, pickFile } from "../lib/bridge/dialog";
import {
  gitConfigPath,
  remoteAdd,
  remoteRemove,
  remoteRename,
  remoteSetUrl,
  remoteUrls,
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
  setAutoRefresh,
} from "../lib/bridge/settings";
import type { GpgKey, Remote, RepoInfo } from "../lib/bridge/types";
import { LOCALE_STORAGE_KEY } from "../lib/i18n/locale";
import { loadStoredSession, saveStoredSession } from "../lib/tabs";
import { useExtrasStore } from "../lib/stores/extras";
import { useLocaleStore } from "../lib/stores/locale";
import { usePaletteStore } from "../lib/stores/palette";
import { useRepoStore } from "../lib/stores/repo";
import {
  AUTO_REFRESH_STORAGE_KEY,
  RESTORE_TABS_STORAGE_KEY,
  useSettingsStore,
} from "../lib/stores/settings";
import { useThemeStore } from "../lib/stores/theme";
import { SettingsWindow } from "./SettingsWindow";

vi.mock("../lib/bridge/settings", () => ({
  configGet: vi.fn(),
  configSet: vi.fn().mockResolvedValue(undefined),
  configUnset: vi.fn().mockResolvedValue(undefined),
  ignoreExcludePath: vi.fn().mockResolvedValue("/tmp/repo/.git/info/exclude"),
  openPath: vi.fn().mockResolvedValue(undefined),
  setAutoRefresh: vi.fn().mockResolvedValue(undefined),
  commitTemplateRead: vi.fn().mockResolvedValue(""),
  commitTemplateWrite: vi.fn().mockResolvedValue("/tmp/repo/.git/commit-template.txt"),
  readTextFile: vi.fn().mockResolvedValue("imported\n"),
  gpgSecretKeys: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/bridge/repo", () => ({
  remoteUrls: vi.fn().mockResolvedValue([]),
  remoteAdd: vi.fn().mockResolvedValue(undefined),
  remoteSetUrl: vi.fn().mockResolvedValue(undefined),
  remoteRename: vi.fn().mockResolvedValue(undefined),
  remoteRemove: vi.fn().mockResolvedValue(undefined),
  gitConfigPath: vi.fn().mockResolvedValue("/tmp/repo/.git/config"),
  submoduleStatus: vi.fn().mockResolvedValue([]),
  worktreeList: vi.fn().mockResolvedValue([]),
  lfsStatus: vi.fn().mockResolvedValue({
    installed: true,
    version: "git-lfs/3.5.1",
    configured: false,
    patterns: [],
  }),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  pickFile: vi.fn().mockResolvedValue("/tmp/template.txt"),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

const REMOTES: Remote[] = [
  { name: "origin", url: "git@example.com:a.git", web_url: "https://example.com/a" },
  { name: "upstream", url: "https://example.com/b.git", web_url: "https://example.com/b" },
];

const GPG_KEYS: GpgKey[] = [
  {
    id: "ABCDEF1234567890",
    fingerprint: "0123456789ABCDEF0123456789ABCDEF01234567",
    user: "Ana <ana@example.com>",
    algo: "RSA 4096",
    created: 1_700_000_000,
    expires: 1_800_000_000,
  },
];

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa0000",
  git_version: "2.50.1",
};

describe("SettingsWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useRepoStore.setState({ repo: REPO, recents: [], openTabs: [], loading: false, error: null });
    useExtrasStore.setState({ remotes: REMOTES });
    vi.mocked(remoteUrls).mockResolvedValue(REMOTES);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(gpgSecretKeys).mockResolvedValue(GPG_KEYS);
    useSettingsStore.setState({ autoRefresh: true, restoreTabs: false });
    useThemeStore.setState({ preference: "system", systemDark: true, resolved: "dark" });
    usePaletteStore.setState({ palette: "default" });
    useLocaleStore.setState({ preference: null, locale: "en" });
    vi.mocked(configGet).mockImplementation(async (_path, key, scope) => {
      if (key === "user.name") return scope === "local" ? "Local Name" : "Global Name";
      if (key === "user.email") {
        return scope === "local" ? "local@example.com" : "global@example.com";
      }
      return null;
    });
  });

  it("opens on Advanced and loads the ignore file and the user info", async () => {
    render(<SettingsWindow onClose={() => {}} />);

    expect(screen.getByRole("tab", { name: "Advanced" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("Ignore file")).toHaveValue("/tmp/repo/.git/info/exclude");
    await waitFor(() => expect(screen.getByLabelText("Full Name")).toHaveValue("Local Name"));
    expect(screen.getByLabelText("Email address")).toHaveValue("local@example.com");
    expect(screen.getByLabelText("Use global user settings")).not.toBeChecked();
  });

  it("opens the ignore file in the editor", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await screen.findByDisplayValue("/tmp/repo/.git/info/exclude");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(ignoreExcludePath).toHaveBeenCalledWith("/tmp/repo");
    expect(openPath).toHaveBeenCalledWith("/tmp/repo/.git/info/exclude");
  });

  it("writes the repository-local identity on OK", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsWindow onClose={onClose} />);

    const name = await screen.findByLabelText("Full Name");
    await user.clear(name);
    await user.type(name, "Ana");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(configSet).toHaveBeenCalledWith("/tmp/repo", "user.name", "Ana", "local");
    expect(configUnset).not.toHaveBeenCalledWith("/tmp/repo", "user.name", "local");
    expect(configUnset).not.toHaveBeenCalledWith("/tmp/repo", "user.email", "local");
    expect(onClose).toHaveBeenCalled();
  });

  it("with the global identity selected it unsets the local values", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    const global = await screen.findByLabelText("Use global user settings");
    await user.click(global);

    expect(screen.getByLabelText("Full Name")).toBeDisabled();
    expect(screen.getByLabelText("Full Name")).toHaveValue("Global Name");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(configUnset).toHaveBeenCalledWith("/tmp/repo", "user.name", "local");
    expect(configUnset).toHaveBeenCalledWith("/tmp/repo", "user.email", "local");
    expect(configSet).not.toHaveBeenCalled();
  });

  it("applies the automatic refresh preference on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    const checkbox = await screen.findByLabelText(/Automatically refresh/);
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(setAutoRefresh).toHaveBeenCalledWith(false);
    expect(useSettingsStore.getState().autoRefresh).toBe(false);
    expect(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY)).toBe("false");
  });

  it("enables restoring the open tabs from the General tab on OK", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({
      openTabs: [{ path: "/tmp/repo", name: "repo", opened_at: 1, title: "My repo" }],
    });
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "General" }));
    const checkbox = screen.getByLabelText(/Reopen the repositories/);
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(useSettingsStore.getState().restoreTabs).toBe(true);
    expect(localStorage.getItem(RESTORE_TABS_STORAGE_KEY)).toBe("true");
    expect(loadStoredSession()).toEqual({
      tabs: [{ path: "/tmp/repo", title: "My repo" }],
      active: "/tmp/repo",
    });
  });

  it("disabling the preference clears the stored session", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ restoreTabs: true });
    saveStoredSession([{ path: "/tmp/repo" }], "/tmp/repo");
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "General" }));
    await user.click(screen.getByLabelText(/Reopen the repositories/));
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(useSettingsStore.getState().restoreTabs).toBe(false);
    expect(loadStoredSession()).toBeNull();
  });

  it("changes the theme from the Appearance tab on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.selectOptions(screen.getByLabelText("Theme"), "light");
    expect(useThemeStore.getState().preference).toBe("system");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(useThemeStore.getState().preference).toBe("light");
  });

  it("changes the palette from the Appearance tab on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(screen.getByRole("option", { name: "Code" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Color palette"), "github");
    expect(usePaletteStore.getState().palette).toBe("default");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(usePaletteStore.getState().palette).toBe("github");
  });

  it("changes the language from the Appearance tab on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.selectOptions(screen.getByLabelText("Language"), "es");
    expect(useLocaleStore.getState().locale).toBe("en");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(useLocaleStore.getState().locale).toBe("es");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
  });

  it("lists the remotes and adds a new one", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Remotes" }));
    expect(await screen.findByRole("button", { name: /origin/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByLabelText("Remote name"), "fork");
    await user.type(screen.getByLabelText("Remote URL"), "https://example.com/fork.git");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(remoteAdd).toHaveBeenCalledWith("/tmp/repo", "fork", "https://example.com/fork.git");
  });

  it("edits a remote URL", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Remotes" }));
    await user.click(await screen.findByRole("button", { name: /origin/ }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const url = screen.getByLabelText("Remote URL");
    await user.clear(url);
    await user.type(url, "git@example.com:new.git");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(remoteSetUrl).toHaveBeenCalledWith("/tmp/repo", "origin", "git@example.com:new.git");
  });

  it("renames a remote and updates its URL", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Remotes" }));
    await user.click(await screen.findByRole("button", { name: /origin/ }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const name = screen.getByLabelText("Remote name");
    await user.clear(name);
    await user.type(name, "fork");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(remoteRename).toHaveBeenCalledWith("/tmp/repo", "origin", "fork");
    expect(remoteSetUrl).toHaveBeenCalledWith("/tmp/repo", "fork", "git@example.com:a.git");
  });

  it("removes a remote only after confirming", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Remotes" }));
    await user.click(await screen.findByRole("button", { name: /origin/ }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(confirmDestructive).toHaveBeenCalled();
    expect(remoteRemove).toHaveBeenCalledWith("/tmp/repo", "origin");
  });

  it("opens the repository config file", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Remotes" }));
    await user.click(screen.getByRole("button", { name: "Edit Config File…" }));

    expect(gitConfigPath).toHaveBeenCalledWith("/tmp/repo");
    expect(openPath).toHaveBeenCalledWith("/tmp/repo/.git/config");
  });

  it("lists the GPG keys and enables signing on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Security" }));
    const select = await screen.findByLabelText("Signing key");
    expect(select).toBeDisabled();
    expect(
      within(select).getByRole("option", { name: "Ana <ana@example.com>" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Enable GPG key signing/));
    await user.selectOptions(select, "ABCDEF1234567890");
    expect(await screen.findByText("RSA 4096")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(configSet).toHaveBeenCalledWith("/tmp/repo", "commit.gpgsign", "true", "local");
    expect(configSet).toHaveBeenCalledWith(
      "/tmp/repo",
      "user.signingkey",
      "ABCDEF1234567890",
      "local",
    );
  });

  it("unsetting signing clears the local config", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Security" }));
    await screen.findByLabelText(/Enable GPG key signing/);
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(configUnset).toHaveBeenCalledWith("/tmp/repo", "commit.gpgsign", "local");
    expect(configUnset).toHaveBeenCalledWith("/tmp/repo", "user.signingkey", "local");
  });

  it("loads the commit template mode and disables the editor for None", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Commit Template" }));

    expect(await screen.findByLabelText(/None/)).toBeChecked();
    expect(screen.getByLabelText("Commit template")).toBeDisabled();
    expect(commitTemplateRead).toHaveBeenCalledWith("/tmp/repo");
  });

  it("writes a custom commit template on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Commit Template" }));
    await user.click(await screen.findByLabelText(/Custom/));
    const area = screen.getByLabelText("Commit template");
    expect(area).toBeEnabled();
    await user.type(area, "feat: ");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(commitTemplateWrite).toHaveBeenCalledWith("/tmp/repo", "feat: ");
  });

  it("clears the local template when None is selected", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Commit Template" }));
    await screen.findByLabelText(/None/);
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(configUnset).toHaveBeenCalledWith("/tmp/repo", "commit.template", "local");
    expect(commitTemplateWrite).not.toHaveBeenCalled();
  });

  it("imports a template file into the editor", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Commit Template" }));
    await user.click(await screen.findByRole("button", { name: "Import…" }));

    expect(pickFile).toHaveBeenCalled();
    expect(await screen.findByDisplayValue(/imported/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Custom/)).toBeChecked();
  });

  it("Cancel discards the changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsWindow onClose={onClose} />);

    const name = await screen.findByLabelText("Full Name");
    await user.clear(name);
    await user.type(name, "Ana");
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.selectOptions(screen.getByLabelText("Theme"), "light");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(configSet).not.toHaveBeenCalled();
    expect(useThemeStore.getState().preference).toBe("system");
    expect(onClose).toHaveBeenCalled();
  });
});
