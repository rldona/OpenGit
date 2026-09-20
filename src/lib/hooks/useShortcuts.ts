import { useEffect, useRef } from "react";
import { SHORTCUTS, isEditableTarget, matchesShortcut, type ShortcutId } from "../shortcuts";

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/** Registra un único listener global; en campos de texto solo pasan los atajos con `mod`. */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of SHORTCUTS) {
        if (!matchesShortcut(event, shortcut.keys)) {
          continue;
        }
        if (isEditableTarget(event.target) && !shortcut.keys.includes("mod")) {
          continue;
        }
        const handler = handlersRef.current[shortcut.id];
        if (!handler) {
          continue;
        }
        event.preventDefault();
        handler();
        return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
