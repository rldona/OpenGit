import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocaleStore } from "../lib/stores/locale";
import { useUpdateStore } from "../lib/stores/update";
import { UpdateDialog } from "./UpdateDialog";

describe("UpdateDialog", () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
    useLocaleStore.setState({ preference: null, locale: "en" });
  });

  it("renders nothing when idle", () => {
    render(<UpdateDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog in Spanish", () => {
    useLocaleStore.setState({ preference: "es", locale: "es" });
    useUpdateStore.setState({ status: "ready", version: "0.6.0" });
    render(<UpdateDialog />);

    expect(screen.getByText("OpenGit 0.6.0 está listo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reiniciar ahora" })).toBeInTheDocument();
  });

  it("offers Later and Restart now when an update is ready", async () => {
    const user = userEvent.setup();
    const restart = vi.fn().mockResolvedValue(undefined);
    const dismiss = vi.fn();
    useUpdateStore.setState({ status: "ready", version: "0.6.0", restart, dismiss });
    render(<UpdateDialog />);

    expect(screen.getByText("OpenGit 0.6.0 is ready.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restart now" }));
    expect(restart).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("shows download progress", () => {
    useUpdateStore.setState({ status: "downloading", version: "0.6.0", progress: 0.5 });
    render(<UpdateDialog />);

    expect(screen.getByText(/Downloading the update… 50%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveValue(0.5);
  });

  it("reports up-to-date and failures from manual checks", () => {
    useUpdateStore.setState({ status: "up-to-date" });
    const { unmount } = render(<UpdateDialog />);
    expect(screen.getByText("OpenGit is up to date.")).toBeInTheDocument();
    unmount();

    useUpdateStore.setState({ status: "error", detail: "offline" });
    render(<UpdateDialog />);
    expect(screen.getByText("Could not check for updates.")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
