# OG-074 · Point README downloads at the new release

- **Milestone:** Next (post-M8)
- **Status:** done
- **Depends on:** OG-026
- **References:** `README.md`, `docs/guides/development.md`

## Context

The README Download table hardcodes asset URLs with the release tag. After
publishing v0.3.0 the links still pointed at v0.2.0, so users downloaded
the old installers.

## Scope

- Point the five Download links at the v0.3.0 assets.
- Document the README link update as a step of the release process in
  `docs/guides/development.md`.

## Acceptance criteria

- [x] Every Download link resolves to a v0.3.0 asset.
- [x] The release docs mention the README update.

## Out of scope

- Version-agnostic download links (filenames carry the version; the
  release page link already covers that).
