# OG-075 · Image preview flicker and untracked images

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-061, OG-071
- **References:** `src/components/ImageDiffPanel.tsx`, `src/components/DiffPatchPanel.tsx`, `src-tauri/src/git/mod.rs`

## Context

Two image preview bugs:

1. Before/After flickers: a "Loading…" flashes every time the panel
   reloads. Root cause in `ImageDiffPanel`: the effect clears the images
   (`setImages(null)`) on every `[root, target, selected]` change, and its
   cleanup revokes the published blob URLs. Since OG-072 re-selects the
   file on every watcher refresh (new entry object, same key), each
   keystroke-save blanks the panel and reloads both sides.
2. New (untracked) images show "Binary file: no text diff available."
   instead of the image. The backend already resolves untracked sides
   (`before=None` from the missing index blob, `after` from disk); the
   frontend just excludes untracked files from the image preview.

## Scope

- Keep the previous images on screen while the same file reloads; clear
  the panel only when another file is selected. Stale fetches revoke only
  their own unpublished URLs; published URLs are revoked on replace or
  unmount.
- Preview untracked images (after side only, "New binary file" label),
  read-only like the OG-071 text preview.
- No backend changes needed.

## Acceptance criteria

- [x] Saving a file elsewhere no longer blanks an open Before/After
  preview; new bytes swap in without a loading flash.
- [x] Selecting another file still resets the panel (no stale image).
- [x] A new `.png` renders its After side with the "New binary file"
  label; non-image untracked binaries keep the binary message.
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `cargo test`
  green.

## Out of scope

- Staging images, unified-mode single image changes (already as-is).
- Preloading neighboring images.

## Implementation notes (2026-09-19)

- `ImageDiffPanel`: `requestId` guard (stale fetches revoke only their own
  URLs), `published` ref (revoked on replace/unmount instead of every
  cleanup), `shownKey` ref (clear only on file change). Same-key
  re-selects keep old images until the new bytes land.
- `DiffPatchPanel`: `imagePreview` no longer excludes untracked; backend
  `image_sides` already returned `before=None`/`after=disk` for them.
- Tests: same-key keeps images, other-key clears; `DiffView` untracked
  `.png` end-to-end; Rust untracked pair/bytes (after ok, before errors).
- Verified: `typecheck`, `lint`, `format:check`, `npm test` (55 files,
  442 tests), `cargo test --test images`, `clippy --all-targets
  -D warnings`, `cargo fmt --check` green.
