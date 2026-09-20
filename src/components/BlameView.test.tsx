import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlameLine } from "../lib/bridge/types";
import { useBlameStore } from "../lib/stores/blame";
import { useLogStore } from "../lib/stores/log";
import { useUiStore } from "../lib/stores/ui";
import { BlameView } from "./BlameView";

vi.mock("../lib/bridge/blame", () => ({
  blameFile: vi.fn(),
}));

vi.mock("../lib/bridge/log", () => ({
  logPage: vi.fn().mockResolvedValue([]),
  listRefs: vi.fn().mockResolvedValue([]),
}));

const LINES: BlameLine[] = [
  {
    line: 1,
    hash: "a".repeat(40),
    author_name: "Ana",
    author_email: "ana@example.com",
    author_time: 1_700_000_000,
    content: "let uno = 1;",
  },
  {
    line: 2,
    hash: "b".repeat(40),
    author_name: "Bob",
    author_email: "bob@example.com",
    author_time: 1_700_100_000,
    content: "let dos = 2;",
  },
];

describe("BlameView", () => {
  beforeEach(() => {
    useLogStore.getState().reset();
    useUiStore.setState({ activeView: "blame" });
    useBlameStore.setState({
      root: "/tmp/repo",
      file: "src/a.txt",
      lines: LINES,
      loading: false,
      error: null,
    });
  });

  it("renders one row per line with author, date and content", () => {
    render(<BlameView />);

    expect(screen.getByText("src/a.txt")).toBeInTheDocument();
    expect(screen.getByText("let uno = 1;")).toBeInTheDocument();
    expect(screen.getByText("let dos = 2;")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("aaaaaaa")).toBeInTheDocument();
  });

  it("jumps to the commit of the clicked line", async () => {
    const user = userEvent.setup();
    render(<BlameView />);

    await user.click(screen.getByText("let uno = 1;"));

    expect(useUiStore.getState().activeView).toBe("history");
  });

  it("keeps an uncommitted line from jumping", async () => {
    const user = userEvent.setup();
    useBlameStore.setState({
      lines: [
        {
          line: 1,
          hash: "0".repeat(40),
          author_name: "Not Committed Yet",
          author_email: "not.committed.yet",
          author_time: 0,
          content: "borrador",
        },
      ],
    });
    render(<BlameView />);

    await user.click(screen.getByText("borrador"));

    expect(useUiStore.getState().activeView).toBe("blame");
  });
});
