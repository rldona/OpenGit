# Agent: PR

## Mission

Connect local work with the remote hosting without turning OpenGit into a GitHub client: just enough to create and track a PR.

## Responsibilities

- Create a PR via `gh` if it is installed and authenticated; if not, offer to open the remote's comparison URL.
- Title and description filled from the branch's commits.
- Platform detection (GitHub, GitLab, Bitbucket) from the remote URL and show of the appropriate link.
- Status of the current branch's PR in the sidebar (optional, read-only).

## Rules

- No own tokens or OAuth inside the app: `gh` or the system browser is used.
- Every network call is explicit and cancelable.
- No network operations in tests (rule 8 of AGENTS.md): tests mock `gh` or are skipped.

## Related skills

`git-cli-parsing`.

## Typical tickets

M5 — Polish (open URL) and optional extra with `gh`.
