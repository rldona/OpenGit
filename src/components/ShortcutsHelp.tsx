import { SHORTCUTS, formatKeys, type ShortcutGroup, type ShortcutId } from "../lib/shortcuts";
import { useI18n, type MessageKey } from "../lib/i18n";
import { useUiStore } from "../lib/stores/ui";

const GROUPS: ShortcutGroup[] = ["Repository", "Commit", "Navigation", "Help"];

const GROUP_KEYS: Record<ShortcutGroup, MessageKey> = {
  Repository: "shortcuts.groupRepository",
  Commit: "shortcuts.groupCommit",
  Navigation: "shortcuts.groupNavigation",
  Help: "shortcuts.groupHelp",
};

const LABEL_KEYS: Record<ShortcutId, MessageKey> = {
  open: "shortcuts.openRepository",
  refresh: "shortcuts.refresh",
  commit: "shortcuts.commit",
  search: "shortcuts.search",
  viewStatus: "shortcuts.viewStatus",
  viewHistory: "shortcuts.viewHistory",
  viewDiff: "shortcuts.viewDiff",
  prevTab: "shortcuts.prevTab",
  nextTab: "shortcuts.nextTab",
  help: "shortcuts.help",
  close: "shortcuts.close",
};

export function ShortcutsHelp() {
  const { t } = useI18n();
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
        aria-label={t("shortcuts.aria")}
      >
        <header>
          <h2>{t("shortcuts.title")}</h2>
          <button
            type="button"
            aria-label={t("shortcuts.closeAria")}
            onClick={() => setOpen(false)}
          >
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
              <h3>{t(GROUP_KEYS[group])}</h3>
              <dl>
                {items.map((shortcut) => (
                  <div key={shortcut.id} className="shortcut-row">
                    <dt>{formatKeys(shortcut.keys)}</dt>
                    <dd>{t(LABEL_KEYS[shortcut.id])}</dd>
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
