import { useRepoStore } from "../lib/stores/repo";

/**
 * Session tabs for the open repositories (OG-069, OG-070). Hidden with no
 * repo open; with one or more it renders between the toolbar and the content
 * with a `+` button that opens the folder picker. Order is fixed (append on
 * first open, never reorder on switch).
 */
export function RepoTabs() {
  const openTabs = useRepoStore((state) => state.openTabs);
  const activeRoot = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const closeTab = useRepoStore((state) => state.closeTab);
  const pickAndOpen = useRepoStore((state) => state.pickAndOpen);

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <nav className="repo-tabs" role="tablist" aria-label="Open repositories">
      {openTabs.map((tab) => {
        const active = tab.path === activeRoot;
        return (
          <div key={tab.path} className={`repo-tab${active ? " active" : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="repo-tab-open"
              title={tab.path}
              onClick={() => void open(tab.path)}
            >
              {tab.name}
            </button>
            <button
              type="button"
              className="repo-tab-close"
              aria-label={`Close ${tab.name}`}
              title={`Close ${tab.name}`}
              onClick={() => void closeTab(tab.path)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="repo-tab-add"
        aria-label="Open another repository"
        title="Open another repository"
        onClick={() => void pickAndOpen()}
      >
        +
      </button>
    </nav>
  );
}
