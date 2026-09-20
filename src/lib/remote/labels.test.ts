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
  it("titles the pull like SourceTree", () => {
    expect(describeRemoteJob(pull())).toBe('Pulling Branch "main" From "origin"');
  });

  it("without a remote branch it does not name it", () => {
    expect(describeRemoteJob(pull({ branch: null }))).toBe('Pulling From "origin"');
    expect(describeRemoteJob(pull({ remote: null }))).toBe('Pulling Branch "main" From "upstream"');
  });

  it("distinguishes fetching from all remotes", () => {
    expect(describeRemoteJob({ kind: "fetch", prune: false, remote: "origin" })).toBe(
      "Fetching from origin",
    );
    expect(describeRemoteJob({ kind: "fetch", prune: false, remote: null })).toBe(
      "Fetching all remotes",
    );
  });

  it("titles a clone with its URL", () => {
    expect(
      describeRemoteJob({
        kind: "clone",
        url: "https://example.com/repo.git",
        destination: "/tmp/repo",
        depth: null,
        branch: null,
        recurse_submodules: false,
      }),
    ).toBe("Cloning https://example.com/repo.git");
  });

  it("titles the LFS jobs", () => {
    expect(describeRemoteJob({ kind: "lfs_pull", remote: null })).toBe("Downloading LFS objects");
    expect(describeRemoteJob({ kind: "lfs_migrate", include: "*.psd" })).toBe(
      "Migrating *.psd to LFS",
    );
  });
});
