# OG-050 · Pull with dialog and progress window

- **Milestone:** M7 — SourceTree parity (phase 2)
- **Status:** done
- **Depends on:** OG-017, OG-041
- **References:** ROADMAP.md, OG-039

## Context

Pull today starts the job directly (`git pull --ff-only --progress`) and its output
goes to the Output panel, which also starts hidden. A failure only leaves an `error`
in the remote store that **is not painted anywhere**: from the UI it looks like
nothing happens. Nor can you choose remote or branch, or see the progress.

SourceTree solves this with three chained windows: options → progress → error.
This ticket replicates that flow for Pull.

## Scope

- Dialog when pressing Pull: remote, remote URL, remote branch (with Refresh), local
  destination branch (the current one) and options:
  - Commit merged changes immediately (enabled by default) → `--no-commit` if unchecked.
  - Include messages from commits being merged in merge commit → `--log`.
  - Create new commit even if fast-forward merge → `--no-ff`.
  - Rebase instead of merge → `--rebase`.
- Progress window with a bar, streaming output, `Cancel` and `Show Full Output`.
- If it fails, the same window switches to an error state with the output and a `Close` button.
- `JobKind::Pull` accepts explicit remote and branch; the window title is
  `Pulling Branch "<branch>" From "<remote>"`.

## Acceptance criteria

- [x] Pull opens the dialog with the default remote and branch (upstream if it exists).
- [x] OK starts the job and progress is shown; Cancel aborts it.
- [x] A failure shows the full output and does not leave us without a message.
- [x] The dialog options reach git (test of `command_for`).
- [x] UI tests with the mocked bridge.

## Out of scope

- Equivalent dialogs for Push and Fetch (they share the progress/error window).
- `--squash`, `--autostash` and interactive rebase.
- Resolving the unrelated-histories conflict that git rejects without `--allow-unrelated-histories`.
