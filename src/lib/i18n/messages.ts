/**
 * English message catalog: the source of truth for every UI string (OG-099,
 * ADR-0009). `Messages` is derived from it, so the Spanish catalog and every
 * `t()` call are checked against these keys at compile time.
 */
export const en = {
  app: {
    couldNotSetTitle: "Could not set the window title: {error}",
    refreshed: "Refreshed {name}",
    pushConfirm: "Push {branch} to the remote?",
  },
  workspace: {
    title: "Workspace",
    status: "File status",
    history: "History",
    diff: "Diff",
    conflicts: "Conflicts",
    conflictsCount: "Conflicts ({count})",
    search: "Search",
    reflog: "Reflog",
  },
  sidebar: {
    repository: "Repository",
    resize: "Resize sidebar",
  },
  content: {
    history: "History",
  },
  output: {
    title: "Output",
    resize: "Resize output",
  },
  welcome: {
    title: "No repository open",
    subtitle: "Open a repository to see its commit graph and history.",
    chooseFolder: "Choose folder",
    clone: "Clone Repository…",
    create: "Create Repository…",
    recents: "Recent Projects",
    recentsAria: "Recent projects",
    removeRecent: "Remove {name} from recent projects",
    remove: "Remove {name}",
  },
  tabs: {
    aria: "Open repositories",
    close: "Close {name}",
    openAnother: "Open another repository",
    openInNewWindow: "Open in New Window",
  },
  toolbar: {
    noRepo: "No repository open",
    commit: "Commit",
    pull: "Pull",
    push: "Push",
    fetch: "Fetch",
    branch: "Branch",
    merge: "Merge",
    merging: "Merging…",
    stash: "Stash",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    open: "Open",
    opening: "Opening…",
    viewRemote: "View Remote",
    showInFinder: "Show in Finder",
    terminal: "Terminal",
    settings: "Settings",
  },
};

export type Messages = typeof en;
