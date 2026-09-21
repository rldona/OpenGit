export type GitVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type RepoInfo = {
  root: string;
  name: string;
  has_commits: boolean;
  branch: string | null;
  detached: boolean;
  head: string | null;
  git_version: string;
};

export type RecentRepo = {
  path: string;
  name: string;
  opened_at: number;
};

export type PlanCommit = {
  hash: string;
  short: string;
  subject: string;
};

export type TodoAction = "pick" | "reword" | "squash" | "fixup" | "drop";

export type TodoItem = {
  hash: string;
  action: TodoAction;
  message?: string | null;
};

export type ConflictFile = {
  content: string;
  binary: boolean;
};

export type LogSearch = {
  grep: string;
  author: string;
  path: string;
  /** Follow the path across renames (file history, OG-053). */
  follow?: boolean;
};

export type Commit = {
  hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  author_time: number;
  refs: string[];
  subject: string;
  body: string;
};

/** One line of `git blame` (OG-055). */
export type BlameLine = {
  line: number;
  hash: string;
  author_name: string;
  author_email: string;
  author_time: number;
  content: string;
};

export type JobKind =
  | { kind: "fetch"; prune: boolean; remote: string | null }
  | {
      kind: "pull";
      remote: string | null;
      branch: string | null;
      rebase: boolean;
      no_ff: boolean;
      no_commit: boolean;
      include_messages: boolean;
    }
  | { kind: "push"; remote: string | null; set_upstream: boolean }
  | { kind: "push_tag"; remote: string | null; tag: string }
  | {
      kind: "clone";
      url: string;
      destination: string;
      depth: number | null;
      branch: string | null;
      recurse_submodules: boolean;
    }
  | { kind: "lfs_pull"; remote: string | null }
  | { kind: "lfs_migrate"; include: string };

export type Stash = {
  reference: string;
  subject: string;
  timestamp: number;
  hash: string;
};

export type JobOutputEvent = {
  job_id: string;
  stream: string;
  line: string;
};

export type JobFinishedEvent = {
  job_id: string;
  success: boolean;
  exit_code: number;
  cancelled: boolean;
};

/** Result of a merge: `conflicted` leaves the OG-019/OG-020 flow. */
export type MergeResult = {
  conflicted: boolean;
  output: string;
};

/** Content-conflict resolution strategy for a merge (`-X`). */
export type MergeStrategy = "ours" | "theirs";

/** Checkboxes of the merge window (OG-063, OG-059). */
export type MergeOptions = {
  noFf: boolean;
  noCommit: boolean;
  includeMessages: boolean;
  squash: boolean;
  strategy: MergeStrategy | null;
  rebase: boolean;
};

/** Effective identity git would use when signing a commit. */
export type AuthorIdent = {
  name: string;
  email: string;
};

export type BranchTracking = {
  current: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
};

export type CommitResult = {
  hash: string;
  subject: string;
};

export type RepoOpState = {
  merge: boolean;
  rebase: boolean;
  cherry_pick: boolean;
  revert: boolean;
  rebase_current: number | null;
  rebase_total: number | null;
};

export type FileDiff = {
  path: string;
  orig_path: string | null;
  binary: boolean;
  added: number | null;
  deleted: number | null;
};

export type StatusKind = "ordinary" | "renamed" | "unmerged" | "untracked" | "ignored";

export type FileStatus = {
  kind: StatusKind;
  xy: string;
  path: string;
  orig_path: string | null;
};

export type StatusReport = {
  head: string | null;
  branch: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: FileStatus[];
};

export type SubmoduleState = "clean" | "modified" | "uninitialized" | "conflict";

export type Submodule = {
  path: string;
  head: string;
  state: SubmoduleState;
  describe: string | null;
};

export type Worktree = {
  path: string;
  head: string;
  branch: string | null;
  detached: boolean;
  bare: boolean;
  locked: boolean;
};

export type LfsStatus = {
  installed: boolean;
  version: string | null;
  configured: boolean;
  patterns: string[];
};

/** A Git hook in the repository (OG-098). */
export type Hook = {
  name: string;
  path: string;
  installed: boolean;
  active: boolean;
  sample: boolean;
  disabled: boolean;
};

export type Remote = {
  name: string;
  url: string;
  web_url: string | null;
};

export type TrackingCommits = {
  incoming: string[];
  outgoing: string[];
};

export type RefEntry = {
  name: string;
  object_id: string;
  object_type: string;
  upstream: string | null;
  track: string | null;
  /** Object it resolves to: in an annotated tag, the peeled commit. */
  target: string;
};

/** Secret GPG key available for commit signing. */
export type GpgKey = {
  id: string;
  fingerprint: string;
  user: string;
  algo: string;
  created: number | null;
  expires: number | null;
};

/** State of a `git bisect` in progress (OG-090). */
export type BisectState = {
  active: boolean;
  current: string | null;
  remaining: number | null;
};

export type BisectMark = "good" | "bad" | "skip";

/** One entry of the reflog (OG-089). */
export type ReflogEntry = {
  hash: string;
  selector: string;
  subject: string;
  author: string;
  time: number;
};

/** Working-tree search query (`git grep`, OG-093). */
export type GrepQuery = {
  pattern: string;
  case_sensitive: boolean;
  whole_word: boolean;
  regex: boolean;
  path: string | null;
  max_results: number | null;
};

/** One match of a working-tree search. */
export type GrepMatch = {
  path: string;
  line: number;
  text: string;
};

export type GrepResult = {
  matches: GrepMatch[];
  truncated: boolean;
};

/** `.gitignore` template for the "Create repository" dialog (OG-086). */
export type GitignoreTemplate = {
  id: string;
  name: string;
};

/** Error serialized by the Rust core (discriminant `kind` field). */
export type GitErrorPayload = {
  kind: string;
  [key: string]: unknown;
};
