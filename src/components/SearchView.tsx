import { useEffect, useMemo } from "react";
import type { GrepMatch } from "../lib/bridge/types";
import { useI18n } from "../lib/i18n";
import { useDiffStore } from "../lib/stores/diff";
import { useGrepStore } from "../lib/stores/grep";
import { useRepoStore } from "../lib/stores/repo";
import { useUiStore } from "../lib/stores/ui";

/**
 * Working-tree search (OG-093): query, options and results grouped by file.
 * Clicking a result opens that file in the diff view.
 */
export function SearchView() {
  const { t } = useI18n();
  const root = useRepoStore((state) => state.repo?.root ?? null);
  const pattern = useGrepStore((state) => state.pattern);
  const caseSensitive = useGrepStore((state) => state.caseSensitive);
  const wholeWord = useGrepStore((state) => state.wholeWord);
  const regex = useGrepStore((state) => state.regex);
  const pathFilter = useGrepStore((state) => state.pathFilter);
  const matches = useGrepStore((state) => state.matches);
  const truncated = useGrepStore((state) => state.truncated);
  const running = useGrepStore((state) => state.running);
  const searched = useGrepStore((state) => state.searched);
  const error = useGrepStore((state) => state.error);
  const setPattern = useGrepStore((state) => state.setPattern);
  const setOption = useGrepStore((state) => state.setOption);
  const run = useGrepStore((state) => state.run);
  const openWorktreeFile = useDiffStore((state) => state.openWorktreeFile);
  const setActiveView = useUiStore((state) => state.setActiveView);

  useEffect(() => {
    // A different repository invalidates the results.
    useGrepStore.getState().reset();
  }, [root]);

  const groups = useMemo(() => {
    const byFile = new Map<string, GrepMatch[]>();
    for (const match of matches) {
      const list = byFile.get(match.path) ?? [];
      list.push(match);
      byFile.set(match.path, list);
    }
    return [...byFile.entries()];
  }, [matches]);

  const openResult = (match: GrepMatch) => {
    if (root === null) {
      return;
    }
    void openWorktreeFile(root, match.path).then(() => setActiveView("diff"));
  };

  const submit = () => {
    if (root !== null) {
      void run(root);
    }
  };

  return (
    <div className="search-view">
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          aria-label={t("search.aria")}
          value={pattern}
          autoFocus
          placeholder={t("search.placeholder")}
          onChange={(event) => setPattern(event.target.value)}
        />
        <button type="submit" disabled={running || pattern === ""}>
          {t("search.submit")}
        </button>
      </form>

      <div className="search-options">
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(event) => setOption("caseSensitive", event.target.checked)}
          />
          {t("search.matchCase")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(event) => setOption("wholeWord", event.target.checked)}
          />
          {t("search.wholeWord")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={regex}
            onChange={(event) => setOption("regex", event.target.checked)}
          />
          {t("search.regex")}
        </label>
        <label className="search-path">
          <span>{t("search.path")}</span>
          <input
            aria-label={t("search.pathFilter")}
            value={pathFilter}
            placeholder={t("search.pathExample")}
            onChange={(event) => setOption("pathFilter", event.target.value)}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {running && <p className="muted">{t("search.searching")}</p>}
      {!running && searched && !error && matches.length === 0 && (
        <p className="muted">{t("search.noMatches")}</p>
      )}
      {truncated && <p className="muted">{t("search.truncated", { count: matches.length })}</p>}

      <ul className="search-results">
        {groups.map(([path, list]) => (
          <li key={path} className="search-file">
            <h3 className="search-file-path">{path}</h3>
            <ul>
              {list.map((match) => (
                <li key={`${path}:${match.line}`}>
                  <button type="button" className="search-match" onClick={() => openResult(match)}>
                    <span className="search-line">{match.line}</span>
                    <span className="search-text">{match.text.trim()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
