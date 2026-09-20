# OG-061 · Image preview and comparison

- **Milestone:** M8 — SourceTree parity (phase 3)
- **Status:** done
- **Depends on:** OG-005, OG-044
- **References:** ROADMAP.md, OG-039

## Context

A binary file only says "Binary file: no text diff available". SourceTree
previews image changes: the result for a new file and a before/after
comparison for a modified one, over a checkerboard so transparency is
visible. Today, seeing an image change means opening the file outside the
app.

## Scope

- `image_pair` detects both sides of the change and returns their MIME types
  (sniffed from magic bytes, extension as fallback); `image_blob` returns the
  raw bytes of one side.
- Three sources work with the same commands: a commit (`rev` vs `rev^`), the
  index (`HEAD` vs staged blob) and the working tree (index vs file).
- The patch panel renders the image instead of the "binary" notice when the
  file is an image: side by side with Before/After labels in "Side by side"
  mode, only the resulting image in "Unified" mode.
- Checkerboard background and `object-fit: contain`, so transparent and
  oversized images read well.

## Acceptance criteria

- [x] A new image in a commit shows the "After" image.
- [x] A modified image shows Before and After in side-by-side mode and only
      After in unified mode.
- [x] Worktree changes (staged and unstaged) preview too.
- [x] A deleted image shows the "Before" side.
- [x] Non-image binaries keep the current message.
- [x] Tests: Rust integration for pair/bytes and MIME sniffing; frontend for
      the panel and the routing in the patch panel.

## Out of scope

- Zoom, pan and pixel diff.
- SVG (it is text and keeps the text diff).
- Video, PDF or other non-image binaries.

## Technical notes

- Raw bytes travel through `tauri::ipc::Response`; the UI builds an object URL
  with the returned MIME, so there is no base64 dependency.
- Deleting the object URLs on selection change is mandatory to avoid leaking
  memory in a long session.
- The path coming from git is validated as repo-relative before reading the
  working tree.
