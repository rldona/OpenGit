import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { imageBlob, imagePair } from "../lib/bridge/diff";
import { useDiffStore, type DiffFileEntry } from "../lib/stores/diff";
import { ImageDiffPanel } from "./ImageDiffPanel";

vi.mock("../lib/bridge/diff", () => ({
  diffFile: vi.fn(),
  commitFiles: vi.fn(),
  diffNumstat: vi.fn(),
  stageSelection: vi.fn(),
  discardSelection: vi.fn(),
  imagePair: vi.fn(),
  imageBlob: vi.fn(),
}));

const ENTRY: DiffFileEntry = {
  key: "worktree:logo.png",
  path: "logo.png",
  orig_path: null,
  added: null,
  deleted: null,
  binary: true,
  untracked: false,
  staged: false,
};

describe("ImageDiffPanel", () => {
  beforeEach(() => {
    vi.mocked(imagePair).mockResolvedValue({ before: "image/png", after: "image/png" });
    vi.mocked(imageBlob).mockResolvedValue(new ArrayBuffer(8));
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
    useDiffStore.setState({
      root: "/tmp/repo",
      target: { kind: "worktree" },
      selected: ENTRY,
      mode: "side",
    });
  });

  it("compara antes y después en modo side by side", async () => {
    render(<ImageDiffPanel />);

    expect(await screen.findByAltText("Before")).toBeInTheDocument();
    expect(screen.getByAltText("After")).toBeInTheDocument();
    expect(screen.getByText("Modified binary file")).toBeInTheDocument();
    expect(imagePair).toHaveBeenCalledWith({
      path: "/tmp/repo",
      file: "logo.png",
      rev: null,
      staged: false,
    });
  });

  it("en modo unificado muestra solo el resultado", async () => {
    useDiffStore.setState({ mode: "unified" });
    render(<ImageDiffPanel />);

    expect(await screen.findByAltText("After")).toBeInTheDocument();
    expect(screen.queryByAltText("Before")).not.toBeInTheDocument();
  });

  it("un fichero nuevo solo tiene después", async () => {
    vi.mocked(imagePair).mockResolvedValue({ before: null, after: "image/png" });
    render(<ImageDiffPanel />);

    expect(await screen.findByAltText("After")).toBeInTheDocument();
    expect(screen.getByText("New binary file")).toBeInTheDocument();
  });

  it("un fichero borrado solo tiene antes", async () => {
    vi.mocked(imagePair).mockResolvedValue({ before: "image/png", after: null });
    render(<ImageDiffPanel />);

    expect(await screen.findByAltText("Before")).toBeInTheDocument();
    expect(screen.getByText("Deleted binary file")).toBeInTheDocument();
  });

  it("expone el error si no se pueden leer las imágenes", async () => {
    vi.mocked(imagePair).mockRejectedValue(new Error("boom"));
    render(<ImageDiffPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
