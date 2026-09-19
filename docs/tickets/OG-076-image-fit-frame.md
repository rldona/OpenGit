# OG-076 · Fit image previews inside their frame

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-061
- **References:** `src/styles/global.css` (`.image-frame img`)

## Context

Image previews render at natural size: large images overflow their frame
and get cropped by the panel (or force scrolling), so they often cannot
be seen at a glance.

Root cause: `.image-frame img` caps with `max-width/max-height: 100%`,
but `.diff-pane` is not a flex column, so the frame height is indefinite
and the percentage cap never applies.

## Scope

- Cap preview images with definite units so they always fit:
  `max-width: 100%` (width is definite) plus a viewport-relative
  `max-height`, keeping aspect ratio. Small images stay at natural size;
  large ones shrink to fit like the reference screenshot.
- CSS-only change; no component or backend changes.

## Acceptance criteria

- [x] A 1024px image fits inside its frame without panel scrolling.
- [x] Small images still render at natural size.
- [x] `npm run format:check`, image-related tests green.

## Out of scope

- Click-to-zoom or actual-size toggle.
- Restructuring `.diff-pane` into a flex column (touches text diff
  layout; revisit with visual checks).
