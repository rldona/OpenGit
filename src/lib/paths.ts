/** Joins a parent folder and a name using the parent's separator. */
export function joinFolderPath(parent: string, name: string): string {
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[/\\]+$/, "")}${separator}${name}`;
}
