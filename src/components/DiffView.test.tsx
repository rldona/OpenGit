import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "../lib/bridge/dialog";
import {
  diffFile,
  diffNumstat,
  discardSelection,
  imageBlob,
  imagePair,
  untrackedFileDiff,
} from "../lib/bridge/diff";
import { statusRepo } from "../lib/bridge/status";
import { openEditor, revealInFileManager } from "../lib/bridge/opener";
import { openPath } from "../lib/bridge/settings";
import type { RepoInfo, StatusReport } from "../lib/bridge/types";
import { useDiffStore } from "../lib/stores/diff";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";
import { DiffView } from "./DiffView";

vi.mock("./DiffEditor", () => ({
  DiffEditor: () => <div data-testid="diff-editor" />,
}));

vi.mock("../lib/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
  confirmDestructive: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  untrackedFileDiff: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
  imagePair: vi.fn(),
  imageBlob: vi.fn(),
}));

vi.mock("../lib/bridge/opener", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  openTerminal: vi.fn().mockResolvedValue(undefined),
  revealInFileManager: vi.fn().mockResolvedValue(undefined),
  openEditor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/bridge/settings", () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/bridge/settings", () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/bridge/status", () => ({
  statusRepo: vi.fn(),
  stagePath: vi.fn(),
  unstagePath: vi.fn(),
  discardPath: vi.fn(),
  deleteUntracked: vi.fn(),
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

const REPORT: StatusReport = {
  head: "aaaa",
  branch: "main",
  detached: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [
    { kind: "ordinary", xy: ".M", path: "a.txt", orig_path: null },
    { kind: "ordinary", xy: ".M", path: "bin.bin", orig_path: null },
  ],
};

const PATCH = "diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-viejo\n+nuevo\n";

describe("DiffView", () => {
  beforeEach(() => {
    vi.mocked(statusRepo).mockResolvedValue(REPORT);
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "a.txt", orig_path: null, binary: false, added: 1, deleted: 1 },
      { path: "bin.bin", orig_path: null, binary: true, added: null, deleted: null },
    ]);
    vi.mocked(diffFile).mockImplementation(async ({ file }) =>
      file === "bin.bin" ? "Binary files a/bin.bin and b/bin.bin differ\n" : PATCH,
    );
    useRepoStore.setState({ repo: REPO, recents: [], openTabs: [], loading: false, error: null });
    useDiffStore.getState().reset();
    useUiStore.setState({ fileTree: false });
  });

  it("starts in Unified and list mode, not side by side or tree", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    expect(await screen.findAllByText("a.txt")).not.toHaveLength(0);
    expect(screen.getByText("bin.bin")).toBeInTheDocument();
    // The path also appears in the header of the right pane (SourceTree style).
    expect(document.querySelector(".diff-pane-path")).toHaveTextContent("a.txt");
    expect(screen.getByRole("button", { name: "Unified" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "List" })).toHaveClass("active");
    expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Side by side" }));

    expect(await screen.findByTestId("diff-editor")).toBeInTheDocument();
  });

  it("heads the patch panel with the file path and its counters", async () => {
    render(<DiffView />);
    await screen.findAllByText("a.txt");

    const head = document.querySelector(".diff-pane-head") as HTMLElement;
    expect(head).toHaveTextContent("a.txt");
    expect(head).toHaveTextContent("+1");
    expect(head).toHaveTextContent("-1");
  });

  it("previews binary images instead of the binary notice", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "logo.png", orig_path: null, binary: true, added: null, deleted: null },
    ]);
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "ordinary", xy: ".M", path: "logo.png", orig_path: null }],
    });
    vi.mocked(imagePair).mockResolvedValue({ before: "image/png", after: "image/png" });
    vi.mocked(imageBlob).mockResolvedValue(new ArrayBuffer(4));
    render(<DiffView />);

    expect(await screen.findByAltText("After")).toBeInTheDocument();
    expect(screen.queryByText(/Binary file/)).not.toBeInTheDocument();
  });

  it("does not render the patch headers above the first hunk", async () => {
    render(<DiffView />);
    await screen.findAllByText("a.txt");

    // `diff --git`, `index`, `---` and `+++` are hidden: the path is already above.
    expect(screen.queryByText(/^diff --git/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^index /)).not.toBeInTheDocument();
  });

  it("groups in a tree, aggregates counters and collapses directories", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ fileTree: true });
    vi.mocked(diffNumstat).mockResolvedValue([
      { path: "src/a.ts", orig_path: null, binary: false, added: 2, deleted: 1 },
      { path: "src/b.ts", orig_path: null, binary: false, added: 3, deleted: 0 },
    ]);
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [
        { kind: "ordinary", xy: ".M", path: "src/a.ts", orig_path: null },
        { kind: "ordinary", xy: ".M", path: "src/b.ts", orig_path: null },
      ],
    });
    render(<DiffView />);

    expect(await screen.findByRole("button", { name: /src\// })).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /src\// }));

    expect(screen.queryByText("a.ts")).not.toBeInTheDocument();
  });

  it("warns about binary files without an editor", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByText("bin.bin"));

    expect(await screen.findByText(/Binary file/)).toBeInTheDocument();
    expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
  });

  it("switches to unified mode with staging actions", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));

    expect(useDiffStore.getState().mode).toBe("unified");
    expect(await screen.findByRole("button", { name: "Stage hunk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage file" })).toBeInTheDocument();
  });

  it("warns when the patch is an LFS pointer", async () => {
    vi.mocked(diffFile).mockResolvedValue(
      [
        "diff --git a/a.txt b/a.txt",
        "@@ -1,3 +1,3 @@",
        "+version https://git-lfs.github.com/spec/v1",
        `+oid sha256:${"a".repeat(64)}`,
        "+size 4096",
      ].join("\n"),
    );
    render(<DiffView />);

    expect(await screen.findByText(/Git LFS pointer/)).toHaveTextContent("4096 bytes");
  });

  it("discards a hunk after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(discardSelection).mockResolvedValue(undefined);
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    await user.click(await screen.findByRole("button", { name: "Discard hunk" }));

    expect(confirmDestructive).toHaveBeenCalled();
    expect(discardSelection).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "a.txt",
      selection: { kind: "hunk", index: 0 },
    });
  });

  it("does not discard if the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmDestructive).mockResolvedValue(false);
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    await user.click(await screen.findByRole("button", { name: "Discard hunk" }));

    expect(discardSelection).not.toHaveBeenCalled();
  });

  it("hides stage and discard with the reversed diff", async () => {
    const user = userEvent.setup();
    render(<DiffView />);

    await user.click(await screen.findByRole("button", { name: "Unified" }));
    expect(await screen.findByRole("button", { name: "Stage hunk" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reverse" }));

    expect(screen.queryByRole("button", { name: "Stage hunk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard hunk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stage file" })).not.toBeInTheDocument();
  });

  it("previews an untracked file read-only with its counters", async () => {
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "untracked", xy: "?", path: "nuevo.txt", orig_path: null }],
    });
    vi.mocked(untrackedFileDiff).mockResolvedValue(
      [
        "diff --git a/nuevo.txt b/nuevo.txt",
        "new file mode 100644",
        "index 0000000..70e300c",
        "--- /dev/null",
        "+++ b/nuevo.txt",
        "@@ -0,0 +1,2 @@",
        "+hola",
        "+mundo",
      ].join("\n"),
    );
    render(<DiffView />);

    // The single untracked file is selected automatically on open.
    expect(await screen.findByText("+hola")).toBeInTheDocument();
    expect(untrackedFileDiff).toHaveBeenCalledWith("/tmp/repo", "nuevo.txt");
    expect(screen.queryByText(/no diff yet/)).not.toBeInTheDocument();
    const head = document.querySelector(".diff-pane-head") as HTMLElement;
    expect(head).toHaveTextContent("+2");
    expect(screen.queryByRole("button", { name: "Stage hunk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stage file" })).not.toBeInTheDocument();
  });

  it("previews an untracked image with only an after side", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      writable: true,
    });
    vi.mocked(statusRepo).mockResolvedValue({
      ...REPORT,
      entries: [{ kind: "untracked", xy: "?", path: "nuevo.png", orig_path: null }],
    });
    vi.mocked(untrackedFileDiff).mockResolvedValue(
      [
        "diff --git a/nuevo.png b/nuevo.png",
        "new file mode 100644",
        "index 0000000..8352675",
        "Binary files /dev/null and b/nuevo.png differ",
      ].join("\n"),
    );
    vi.mocked(imagePair).mockResolvedValue({ before: null, after: "image/png" });
    vi.mocked(imageBlob).mockResolvedValue(new ArrayBuffer(8));
    render(<DiffView />);

    expect(await screen.findByAltText("After")).toBeInTheDocument();
    expect(screen.getByText("New binary file")).toBeInTheDocument();
    expect(screen.queryByText(/Binary file: no text/)).not.toBeInTheDocument();
    expect(imagePair).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "nuevo.png",
      rev: null,
      staged: false,
    });
  });

  it("opens worktree files externally from the context menu", async () => {
    const user = userEvent.setup();
    render(<DiffView />);
    const files = document.querySelector(".diff-files") as HTMLElement;
    fireEvent.contextMenu(await within(files).findByText("a.txt"), { clientX: 10, clientY: 10 });

    await user.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(openPath).toHaveBeenCalledWith("/tmp/repo/a.txt");

    fireEvent.contextMenu(within(files).getByText("a.txt"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: "Open in VS Code" }));
    expect(openEditor).toHaveBeenCalledWith("/tmp/repo/a.txt");

    fireEvent.contextMenu(within(files).getByText("a.txt"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: "Show in Finder" }));
    expect(revealInFileManager).toHaveBeenCalledWith("/tmp/repo/a.txt");
  });

  it("offers no external actions on commit files", async () => {
    const entry = {
      key: "commit:a.txt",
      path: "a.txt",
      orig_path: null,
      added: 1,
      deleted: 1,
      binary: false,
      untracked: false,
      staged: false,
    };
    useDiffStore.setState({
      root: "/tmp/repo",
      target: { kind: "commit", rev: "abc1234" },
      files: [entry],
      selected: entry,
      patch: PATCH,
      binary: false,
    });
    render(<DiffView />);
    const files = document.querySelector(".diff-files") as HTMLElement;
    fireEvent.contextMenu(within(files).getByText("a.txt"), { clientX: 10, clientY: 10 });

    expect(screen.queryByRole("menuitem", { name: "Open" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Open in VS Code" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Show in Finder" })).not.toBeInTheDocument();
  });
});
