import { describe, expect, it } from "vitest";
import { describeRemoteError } from "./errors";

describe("describeRemoteError", () => {
  it("detecta un push rechazado por non-fast-forward", () => {
    const hint = describeRemoteError([
      "To /tmp/remote",
      " ! [rejected]        main -> main (non-fast-forward)",
      "error: failed to push some refs to '/tmp/remote'",
    ]);
    expect(hint).toContain("Pull first");
  });

  it("detecta fallos de autenticación", () => {
    const hint = describeRemoteError([
      "fatal: Authentication failed for 'https://example.com/repo.git/'",
    ]);
    expect(hint).toContain("credential helper");
  });

  it("detecta remoto inexistente", () => {
    expect(
      describeRemoteError(["fatal: repository 'https://example.com/nope.git/' not found"]),
    ).toContain("not found or unreachable");
    expect(
      describeRemoteError(["fatal: '/tmp/nope' does not appear to be a git repository"]),
    ).toContain("not found or unreachable");
  });

  it("detecta una rama sin upstream", () => {
    const hint = describeRemoteError(["fatal: The current branch feature has no upstream branch"]);
    expect(hint).toContain("no upstream");
  });

  it("devuelve null cuando no reconoce la causa", () => {
    expect(describeRemoteError(["everything is fine"])).toBeNull();
  });
});
