# OG-015 · Tag management

- **Milestone:** M3 — Advanced history
- **Status:** done
- **Depends on:** OG-008, OG-011
- **References:** docs/architecture/overview.md

## Context

The sidebar already lists tags (annotated and lightweight) but does not allow creating, deleting or pushing them to the remote.

## Scope

- Create a lightweight or annotated tag (with a message) on the selected commit or HEAD.
- Delete a local tag with confirmation.
- Push the tag to the remote reusing the job system (streaming and cancellation).
- Keep the visual distinction annotated/lightweight.

## Acceptance criteria

- [x] Create a lightweight and an annotated tag and see them in the sidebar with their correct type. _(Rust and UI tests)_
- [x] The annotated tag stores the message. _(test with `git tag -n -l`)_
- [x] Deleting a tag asks for confirmation and it disappears from the sidebar. _(native confirmation + test)_
- [x] Pushing the tag to the remote is shown in streaming and leaves the tag on the remote. _(JobKind::PushTag + test with local bare)_
- [x] Invalid names are rejected with a readable error (`git check-ref-format`). _(test)_

## Out of scope

- Edit or move existing tags.
- Tag signing.

## Technical notes

- Create: `git tag <name> <target>` / `git tag -a <name> -m <msg> <target>`; delete: `git tag -d <name>`.
- Push: new `JobKind::PushTag` → `git push --progress <remote> refs/tags/<name>` (default `origin`).
- The name is validated with `git check-ref-format` before touching anything.

## Implementation notes (2026-09-18)

- Rust: `tag_create` and `tag_delete` in `git/mod.rs`; `JobKind::PushTag` reuses the OG-011 streaming.
- UI: in the Tags sidebar, a "+" button (name, optional message and annotated checkbox; target = selected commit or HEAD) and Delete/Push actions per tag with confirmation on deletion.
- Tests: Rust (create lightweight/annotated, delete, invalid name, push to local bare) and frontend (store and sidebar).
- Closed on 2026-09-18 with green CI (Frontend 30 s, Rust 1m13s) in PR #12, together with OG-016.
