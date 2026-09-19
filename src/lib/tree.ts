export type FileTreeFile<T> = {
  kind: "file";
  path: string;
  name: string;
  item: T;
};

export type FileTreeDir<T> = {
  kind: "dir";
  path: string;
  name: string;
  children: FileTreeNode<T>[];
  /** All descendant files, used to aggregate counters. */
  files: T[];
};

export type FileTreeNode<T> = FileTreeDir<T> | FileTreeFile<T>;

function compareNodes<T>(left: FileTreeNode<T>, right: FileTreeNode<T>): number {
  if (left.kind !== right.kind) {
    return left.kind === "dir" ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
}

/** Builds the tree from git paths (`a/b/c.txt`); does not touch disk. */
export function buildFileTree<T>(items: T[], pathOf: (item: T) => string): FileTreeNode<T>[] {
  type DirBuilder = {
    path: string;
    name: string;
    dirs: Map<string, DirBuilder>;
    files: FileTreeFile<T>[];
  };

  const root: DirBuilder = { path: "", name: "", dirs: new Map(), files: [] };

  for (const item of items) {
    const path = pathOf(item);
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    let current = root;
    for (const segment of segments.slice(0, -1)) {
      const dirPath = current.path === "" ? segment : `${current.path}/${segment}`;
      let next = current.dirs.get(segment);
      if (!next) {
        next = { path: dirPath, name: segment, dirs: new Map(), files: [] };
        current.dirs.set(segment, next);
      }
      current = next;
    }
    current.files.push({
      kind: "file",
      path,
      name: segments[segments.length - 1],
      item,
    });
  }

  const materialize = (dir: DirBuilder): FileTreeDir<T> => {
    const children: FileTreeNode<T>[] = [...[...dir.dirs.values()].map(materialize), ...dir.files];
    children.sort(compareNodes);
    const files = children.flatMap((child) => (child.kind === "dir" ? child.files : [child.item]));
    return { kind: "dir", path: dir.path, name: dir.name, children, files };
  };

  return materialize(root).children;
}
