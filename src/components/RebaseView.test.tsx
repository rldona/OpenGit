import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repoOpState } from "../lib/bridge/commit";
import { confirmDestructive } from "../lib/bridge/dialog";
import { interactiveRebase } from "../lib/bridge/rebase";
import { statusRepo } from "../lib/bridge/status";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useRebaseStore } from "../lib/stores/rebase";
import { useRepoStore } from "../lib/stores/repo";
import { RebaseView } from "./RebaseView";

vi.mock("../lib/bridge/rebase", () => ({
  rebasePlan: vi.fn(),
  interactiveRebase: vi.fn(),
}));

vi.mock("../lib/bridge/commit", () => ({
  commitMessage: vi.fn().mockResolvedValue(""),
  commitRepo: vi.fn(),
  repoOpState: vi.fn(),
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
}));

vi.mock("../lib/bridge/log", () => ({
  listRefs: vi.fn().mockResolvedValue([]),
  logPage: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/bridge/refs", () => ({
  branchTracking: vi
    .fn()
    .mockResolvedValue({ current: "main", upstream: null, ahead: 0, behind: 0 }),
  checkoutRef: vi.fn(),
  createBranch: vi.fn(),
  renameBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));

const REPO: RepoInfo = {
  root: "/tmp/repo",
  name: "repo",
  has_commits: true,
  branch: "main",
  detached: false,
  head: "aaaa",
  git_version: "2.50.1",
};

const CLEAN: StatusReport = {
  head: "a",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
};

const ROWS = [
  { hash: "aaaa1111", short: "aaaa1111", subject: "uno", action: "pick" as const },
  { hash: "bbbb2222", short: "bbbb2222", subject: "dos", action: "pick" as const },
];

describe("RebaseView", () => {
  beforeEach(() => {
    vi.mocked(interactiveRebase).mockResolvedValue(undefined);
    vi.mocked(statusRepo).mockResolvedValue(CLEAN);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(repoOpState).mockResolvedValue({
      merge: false,
      rebase: false,
      cherry_pick: false,
      revert: false,
      rebase_current: null,
      rebase_total: null,
    });
    useRepoStore.setState({ repo: REPO, recents: [], loading: false, error: null });
    useRebaseStore.getState().reset();
    useRebaseStore.setState({ root: REPO.root, base: "base1234567", rows: ROWS });
  });

  it("muestra el plan con acciones y orden", () => {
    render(<RebaseView />);

    expect(screen.getByText("uno")).toBeInTheDocument();
    expect(screen.getByText("dos")).toBeInTheDocument();
    expect(screen.getByLabelText("Action for aaaa1111")).toHaveValue("pick");
  });

  it("permite cambiar acción y reordenar", async () => {
    const user = userEvent.setup();
    render(<RebaseView />);

    await user.selectOptions(screen.getByLabelText("Action for aaaa1111"), "drop");
    await user.click(screen.getByRole("button", { name: "Move bbbb2222 up" }));

    const rows = useRebaseStore.getState().rows;
    expect(rows[0].subject).toBe("dos");
    expect(rows.find((row) => row.subject === "uno")?.action).toBe("drop");
  });

  it("pide mensaje al marcar reword y lo envía al ejecutar", async () => {
    const user = userEvent.setup();
    render(<RebaseView />);

    await user.selectOptions(screen.getByLabelText("Action for aaaa1111"), "reword");
    const runButton = screen.getByRole("button", { name: "Run rebase" });
    expect(runButton).toBeDisabled();

    await user.type(screen.getByLabelText("Reword message"), "mensaje nuevo");
    expect(runButton).toBeEnabled();
    await user.click(runButton);

    expect(confirmDestructive).toHaveBeenCalled();
    expect(interactiveRebase).toHaveBeenCalledWith(
      "/tmp/repo",
      "base1234567",
      [
        { hash: "aaaa1111", action: "reword" },
        { hash: "bbbb2222", action: "pick" },
      ],
      "mensaje nuevo",
    );
  });

  it("cancelar vuelve al historial sin ejecutar", async () => {
    const user = userEvent.setup();
    render(<RebaseView />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(interactiveRebase).not.toHaveBeenCalled();
    expect(useRebaseStore.getState().rows).toHaveLength(0);
  });
});
