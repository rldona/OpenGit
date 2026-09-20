/** Folder name suggested from the URL (`https://host/user/repo.git` -> `repo`). */
export function cloneFolderName(url: string): string {
  const trimmed = url.trim().replace(/[/\\]+$/, "");
  const last = trimmed.split(/[/:\\]/).pop() ?? "";
  return last.replace(/\.git$/, "");
}

/** Joins a parent folder and a name using the parent's separator. */
export function joinClonePath(parent: string, name: string): string {
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[/\\]+$/, "")}${separator}${name}`;
}
