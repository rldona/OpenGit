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

export type ConflictFile = {
  content: string;
  binary: boolean;
};

export type LogSearch = {
  grep: string;
  author: string;
  path: string;
};

export type Commit = {
  hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  author_time: number;
  refs: string[];
  subject: string;
};

export type JobKind =
  | { kind: "fetch"; prune: boolean; remote: string | null }
  | { kind: "pull" }
  | { kind: "push"; remote: string | null; set_upstream: boolean }
  | { kind: "push_tag"; remote: string | null; tag: string };

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

export type RefEntry = {
  name: string;
  object_id: string;
  object_type: string;
  upstream: string | null;
  track: string | null;
};

/** Error serializado por el núcleo Rust (campo `kind` discriminante). */
export type GitErrorPayload = {
  kind: string;
  [key: string]: unknown;
};
