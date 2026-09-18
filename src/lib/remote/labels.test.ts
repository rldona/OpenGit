import { describe, expect, it } from "vitest";
import type { JobKind } from "../bridge/types";
import { describeRemoteJob } from "./labels";

function pull(overrides: Partial<Extract<JobKind, { kind: "pull" }>> = {}): JobKind {
  return {
    kind: "pull",
    remote: "origin",
    branch: "main",
    rebase: false,
    no_ff: false,
    no_commit: false,
    include_messages: false,
    ...overrides,
  };
}

describe("describeRemoteJob", () => {
  it("titula el pull como SourceTree", () => {
    expect(describeRemoteJob(pull())).toBe('Pulling Branch "main" From "origin"');
  });

  it("sin rama remota no la nombra", () => {
    expect(describeRemoteJob(pull({ branch: null }))).toBe('Pulling From "origin"');
    expect(describeRemoteJob(pull({ remote: null }))).toBe('Pulling Branch "main" From "upstream"');
  });

  it("distingue fetch de todos los remotos", () => {
    expect(describeRemoteJob({ kind: "fetch", prune: false, remote: "origin" })).toBe(
      "Fetching from origin",
    );
    expect(describeRemoteJob({ kind: "fetch", prune: false, remote: null })).toBe(
      "Fetching all remotes",
    );
  });
});
