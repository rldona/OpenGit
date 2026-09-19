import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configGet,
  configSet,
  configUnset,
  ignoreExcludePath,
  openPath,
  setAutoRefresh,
} from "../lib/bridge/settings";
import type { RepoInfo } from "../lib/bridge/types";
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
