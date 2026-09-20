import { useI18n } from "../lib/i18n";
import { useRepoStore } from "../lib/stores/repo";

/**
 * Recent projects on the home screen (OG-079). The persisted recents already
 * arrive from the core; this only renders them as a shortcut. Hidden when
 * there is no history, and each item can be removed from history without
 * closing the repository or a tab.
 */
export function RecentProjects() {
  const { t } = useI18n();
  const recents = useRepoStore((state) => state.recents);
  const open = useRepoStore((state) => state.open);
  const removeRecent = useRepoStore((state) => state.removeRecent);

  if (recents.length === 0) {
    return null;
  }

  return (
    <section className="welcome-recents" aria-label={t("welcome.recentsAria")}>
      <h2>{t("welcome.recents")}</h2>
      <ul className="welcome-recents-list">
        {recents.map((recent) => (
          <li key={recent.path} className="welcome-recent">
            <button
              type="button"
              className="welcome-recent-open"
              title={recent.path}
              onClick={() => void open(recent.path)}
            >
              <span className="welcome-recent-name">{recent.name}</span>
              <span className="welcome-recent-path">{recent.path}</span>
            </button>
            <button
              type="button"
              className="welcome-recent-remove"
              aria-label={t("welcome.removeRecent", { name: recent.name })}
              title={t("welcome.remove", { name: recent.name })}
              onClick={() => void removeRecent(recent.path)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
