# OG-117 · README cover with logo, name and screenshot

- **Milestone:** Next
- **Status:** done
- **Depends on:** —
- **References:** `README.md`, `assets/cover.html`, `assets/cover.png`, `scripts/make-cover.sh`

## Context

The README opened with the bare logo and, further down, a full-width
screenshot. The sibling projects (OpenDisk, OpenNote) use a single 1280x640
cover that combines the icon, the name, a tagline and the app inside a window
frame, which also works as the GitHub social preview.

## Scope

- `assets/cover.html` lays out the logo, name, tagline, chips and
  `assets/opengit-screenshot.png` in the same format as OpenDisk and OpenNote.
- `scripts/make-cover.sh` renders it to `assets/cover.png` with headless Chrome.
- The README header shows the cover instead of the logo and the separate
  screenshot.

## Acceptance criteria

- [x] `assets/cover.png` is 1280x640 and matches the OpenDisk/OpenNote layout.
- [x] The README opens with the cover, followed by the description and badges.

## Out of scope

- Retaking the app screenshot.
- Setting the cover as the repository social preview (done in GitHub settings).
