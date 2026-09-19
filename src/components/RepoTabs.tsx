import { useRepoStore } from "../lib/stores/repo";

/**
 * Session tabs for the open repositories (OG-069). Hidden with zero or one
 * tab; with two or more it renders between the toolbar and the content.
 * Order is fixed (append on first open, never reorder on switch).
 */
export function RepoTabs() {
  const openTabs = useRepoStore((state) => state.openTabs);
  const activeRoot = useRepoStore((state) => state.repo?.root ?? null);
  const open = useRepoStore((state) => state.open);
  const closeTab = useRepoStore((state) => state.closeTab);

  if (openTabs.length < 2) {
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
    </nav>
  );
}
