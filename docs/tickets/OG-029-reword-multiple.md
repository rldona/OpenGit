# OG-029 · Multiple reword in interactive rebase (v2)

- **Milestone:** M5 — Polish (v2 of OG-021)
- **Status:** done
- **Depends on:** OG-021
- **References:** ROADMAP.md, docs/tickets/OG-021-rebase-interactivo.md

## Context

OG-021 allowed a single `reword` per plan with a single global message, solved with `pick` + `exec git commit --amend -F`. It was an explicit limitation of v1; now it is lifted.

## Scope

- `TodoItem` gains an optional `message`; each `reword` carries its own message and `interactive_rebase` no longer accepts the global message.
- One message file per reword (`rebase-message-<index>.txt` in the data directory) and an `exec git commit --amend -F` after the corresponding pick.
- No limit on rewords; `reword` without a message is still not allowed.
- Store: the message lives in the row and travels with it when reordering; `run` validates that all rewords have text.
- UI: message input in each row marked as `reword`; the Run button is disabled if any is missing.
- Tests: two rewords with different messages, reword without message, reordering while preserving the message, and validation in store/UI.

## Acceptance criteria

- [x] Two `reword` in the same plan apply two different messages.
- [x] A `reword` without a message fails with a clear error and no reword with an empty message reaches git.
- [x] Reordering a row moves its action **and** its message.
- [x] The UI shows one input per `reword` row and blocks Run until they are completed.
- [x] Rust (integration) and frontend (store and view) tests updated.

## Out of scope

- Editing the message body with a full editor or formatted multiline.
- `edit`, `autosquash` and arbitrary commands (still out, as in OG-021).
- Keeping the message files between runs: they are temporary to the run.

## Technical notes

- The todo-list is still injected with `GIT_SEQUENCE_EDITOR`; the message files are numbered by position in the plan and overwritten on each execution.
- `message` is trimmed when writing the file; `message` in actions other than `reword` is ignored.
- In the UI, the message is not indexed by hash but travels inside the row: reordering already swaps complete rows.

## Implementation notes (2026-09-18)

- Rust: `TodoItem.message` with `#[serde(default)]`; `interactive_rebase` loses the global `reword_message` and writes `rebase-message-<index>.txt` for each reword, with an `exec` after its pick. Validation is per item.
- Frontend: `PlanRow.message`; the store passes `message` only in rewords (`null` in the rest); `RebaseView` renders the input inside the row (with `flex-wrap`) and disables Run if any is missing.
- Tests: 110 Rust (multiple rewords and reword without message separated) and 180 frontend (several messages, travel on reorder and per-row validation).
- Closed on 2026-09-18 with green CI (Frontend 37 s, Rust 1m14s) in PR #26.
