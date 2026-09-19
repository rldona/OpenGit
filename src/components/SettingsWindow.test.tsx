import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import {
  gitConfigPath,
  remoteAdd,
  remoteRemove,
  remoteRename,
  remoteSetUrl,
  remoteUrls,
} from "../lib/bridge/repo";
import {
  configGet,
  configSet,
  configUnset,
  ignoreExcludePath,
  openPath,
  setAutoRefresh,
} from "../lib/bridge/settings";
import type { Remote, RepoInfo } from "../lib/bridge/types";
import { useExtrasStore } from "../lib/stores/extras";
import { useRepoStore } from "../lib/stores/repo";
import { AUTO_REFRESH_STORAGE_KEY, useSettingsStore } from "../lib/stores/settings";
import { useThemeStore } from "../lib/stores/theme";
import { SettingsWindow } from "./SettingsWindow";

vi.mock("../lib/bridge/settings", () => ({
  configGet: vi.fn(),
  configSet: vi.fn().mockResolvedValue(undefined),
  configUnset: vi.fn().mockResolvedValue(undefined),
  ignoreExcludePath: vi.fn().mockResolvedValue("/tmp/repo/.git/info/exclude"),
  openPath: vi.fn().mockResolvedValue(undefined),
  setAutoRefresh: vi.fn().mockResolvedValue(undefined),
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
  lfsStatus: vi
    .fn()
    .mockResolvedValue({ installed: true, version: "git-lfs/3.5.1", configured: false }),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

const REMOTES: Remote[] = [
  { name: "origin", url: "git@example.com:a.git", web_url: "https://example.com/a" },
  { name: "upstream", url: "https://example.com/b.git", web_url: "https://example.com/b" },
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
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useExtrasStore.setState({ remotes: REMOTES });
    vi.mocked(remoteUrls).mockResolvedValue(REMOTES);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    useSettingsStore.setState({ autoRefresh: true });
    useThemeStore.setState({ preference: "system", systemDark: true, resolved: "dark" });
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
    expect(configUnset).not.toHaveBeenCalled();
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

  it("changes the theme from the Appearance tab on OK", async () => {
    const user = userEvent.setup();
    render(<SettingsWindow onClose={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.selectOptions(screen.getByLabelText("Theme"), "light");
    expect(useThemeStore.getState().preference).toBe("system");

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(useThemeStore.getState().preference).toBe("light");
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
