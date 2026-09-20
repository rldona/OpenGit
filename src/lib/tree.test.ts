import { describe, expect, it } from "vitest";
import { buildFileTree, type FileTreeDir } from "./tree";

type Item = { path: string; size: number };

const pathOf = (item: Item) => item.path;

function asDir<T>(node: { kind: string }): FileTreeDir<T> {
  if (node.kind !== "dir") {
    throw new Error("se esperaba un directorio");
  }
  return node as FileTreeDir<T>;
}

describe("buildFileTree", () => {
  it("agrupa por segmentos y ordena directorios antes que ficheros", () => {
    const tree = buildFileTree<Item>(
      [
        { path: "src/b.ts", size: 1 },
        { path: "a.txt", size: 2 },
        { path: "src/a.ts", size: 3 },
      ],
      pathOf,
    );

    expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual(["dir:src", "file:a.txt"]);
    const src = asDir<Item>(tree[0]);
    expect(src.children.map((node) => node.name)).toEqual(["a.ts", "b.ts"]);
    expect(src.files.map((item) => item.size)).toEqual([3, 1]);
  });

  it("anida varios niveles y guarda los descendientes", () => {
    const tree = buildFileTree<Item>(
      [
        { path: "src/lib/deep/file.ts", size: 1 },
        { path: "src/main.ts", size: 2 },
        { path: "docs/readme.md", size: 3 },
      ],
      pathOf,
    );

    expect(tree.map((node) => node.name)).toEqual(["docs", "src"]);
    const src = asDir<Item>(tree[1]);
    expect(src.files.map((item) => item.path)).toEqual(["src/lib/deep/file.ts", "src/main.ts"]);
    const lib = asDir<Item>(src.children.find((node) => node.name === "lib")!);
    expect(lib.path).toBe("src/lib");
    expect(lib.files).toHaveLength(1);
  });

  it("ignora rutas vacías y no toca el orden de ficheros sueltos", () => {
    const tree = buildFileTree<Item>(
      [
        { path: "", size: 0 },
        { path: "z.txt", size: 1 },
        { path: "a.txt", size: 2 },
      ],
      pathOf,
    );

    expect(tree.map((node) => node.name)).toEqual(["a.txt", "z.txt"]);
  });
});
