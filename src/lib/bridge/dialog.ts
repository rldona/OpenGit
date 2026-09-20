import { ask, open } from "@tauri-apps/plugin-dialog";

/** Native folder picker; `null` when the user cancels. */
export async function pickDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open repository",
  });
  return typeof selected === "string" ? selected : null;
}

/** Confirmation for destructive operations (discard, delete). */
export function confirmDestructive(message: string): Promise<boolean> {
  return ask(message, { title: "Confirm action", kind: "warning" });
}
