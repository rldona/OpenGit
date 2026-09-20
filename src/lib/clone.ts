/** Folder name suggested from the URL (`https://host/user/repo.git` -> `repo`). */
export function cloneFolderName(url: string): string {
  const trimmed = url.trim().replace(/[/\\]+$/, "");
  const last = trimmed.split(/[/:\\]/).pop() ?? "";
  return last.replace(/\.git$/, "");
}
