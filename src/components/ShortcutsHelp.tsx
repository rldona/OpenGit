import { SHORTCUTS, formatKeys, type ShortcutGroup } from "../lib/shortcuts";
import { useUiStore } from "../lib/stores/ui";

const GROUPS: ShortcutGroup[] = ["Repository", "Commit", "Navigation", "Help"];

export function ShortcutsHelp() {
  const open = useUiStore((state) => state.shortcutsOpen);
  const setOpen = useUiStore((state) => state.setShortcutsOpen);

  if (!open) {
    return null;
  }

  return (
    <div className="shortcuts-overlay">
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header>
          <h2>Keyboard shortcuts</h2>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        {GROUPS.map((group) => {
          const items = SHORTCUTS.filter((shortcut) => shortcut.group === group);
          if (items.length === 0) {
            return null;
          }
          return (
            <section key={group}>
              <h3>{group}</h3>
              <dl>
                {items.map((shortcut) => (
                  <div key={shortcut.id} className="shortcut-row">
                    <dt>{formatKeys(shortcut.keys)}</dt>
                    <dd>{shortcut.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
