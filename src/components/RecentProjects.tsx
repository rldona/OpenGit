import { useRepoStore } from "../lib/stores/repo";

/**
 * Recent projects on the home screen (OG-079). The persisted recents already
 * arrive from the core; this only renders them as a shortcut. Hidden when
 * there is no history, and each item can be removed from history without
 * closing the repository or a tab.
 */
export function RecentProjects() {
  const recents = useRepoStore((state) => state.recents);
  const open = useRepoStore((state) => state.open);
  const removeRecent = useRepoStore((state) => state.removeRecent);

  if (recents.length === 0) {
    return null;
  }

  return (
    <section className="welcome-recents" aria-label="Recent projects">
      <h2>Recent Projects</h2>
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
              aria-label={`Remove ${recent.name} from recent projects`}
              title={`Remove ${recent.name}`}
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
