import { describe, expect, it } from "vitest";
import { describeRemoteError } from "./errors";

describe("describeRemoteError", () => {
  it("detects a push rejected as non-fast-forward", () => {
    const hint = describeRemoteError([
      "To /tmp/remote",
      " ! [rejected]        main -> main (non-fast-forward)",
      "error: failed to push some refs to '/tmp/remote'",
    ]);
    expect(hint).toContain("Pull first");
  });

  it("detects authentication failures", () => {
    const hint = describeRemoteError([
      "fatal: Authentication failed for 'https://example.com/repo.git/'",
    ]);
    expect(hint).toContain("credential helper");
  });

  it("detects a missing remote", () => {
    expect(
      describeRemoteError(["fatal: repository 'https://example.com/nope.git/' not found"]),
    ).toContain("not found or unreachable");
    expect(
      describeRemoteError(["fatal: '/tmp/nope' does not appear to be a git repository"]),
    ).toContain("not found or unreachable");
  });

  it("detects a branch with no upstream", () => {
    const hint = describeRemoteError(["fatal: The current branch feature has no upstream branch"]);
    expect(hint).toContain("no upstream");
  });

  it("returns null when it does not recognize the cause", () => {
    expect(describeRemoteError(["everything is fine"])).toBeNull();
  });
});
