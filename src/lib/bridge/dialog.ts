import { open } from "@tauri-apps/plugin-dialog";

/** Selector nativo de carpeta; `null` si el usuario cancela. */
export async function pickDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Abrir repositorio",
  });
  return typeof selected === "string" ? selected : null;
}
