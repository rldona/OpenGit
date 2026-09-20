import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FileTree } from "./FileTree";

type Item = { path: string };

const ITEMS: Item[] = [{ path: "src/a.ts" }, { path: "src/lib/b.ts" }, { path: "README.md" }];

describe("FileTree", () => {
  it("pinta directorios y ficheros con su nombre", () => {
    render(
      <FileTree
        items={ITEMS}
        pathOf={(item) => item.path}
        renderFile={(_item, name) => <span>{name}</span>}
      />,
    );

    expect(screen.getByRole("button", { name: /src\// })).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lib\// })).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
  });

  it("pliega y despliega un directorio", async () => {
    const user = userEvent.setup();
    render(
      <FileTree
        items={ITEMS}
        pathOf={(item) => item.path}
        renderFile={(_item, name) => <span>{name}</span>}
      />,
    );

    const src = screen.getByRole("button", { name: /src\// });
    expect(src).toHaveAttribute("aria-expanded", "true");

    await user.click(src);

    expect(src).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("a.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("b.ts")).not.toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();

    await user.click(src);

    expect(screen.getByText("a.ts")).toBeInTheDocument();
  });

  it("ofrece extras por directorio", () => {
    render(
      <FileTree
        items={[{ path: "src/a.ts" }]}
        pathOf={(item) => item.path}
        renderFile={(_item, name) => <span>{name}</span>}
        renderDirExtra={(dir) => <span>files:{dir.files.length}</span>}
      />,
    );

    expect(screen.getByText("files:1")).toBeInTheDocument();
  });
});
