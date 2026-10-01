# OG-116 · Document the draft release step in the release workflow

- **Milestone:** Next
- **Status:** done
- **Depends on:** —
- **References:** `.ai/workflows/release.md`, `.github/workflows/release.yml`, OG-081, OG-028

## Context

Step 5 of `.ai/workflows/release.md` says that pushing the tag builds, signs and
"creates the release on GitHub". That is out of date: the `release` job in
`release.yml` runs `gh release create "$TAG" --draft --generate-notes` (or uploads
to an existing release), so the release stays a **draft** until someone publishes
it by hand. Until then it is not `Latest` and the updater endpoint
(`releases/latest/download/latest.json`) does not serve it. The workflow also
never says that publishing is a separate step, so v0.8.6 sat as a draft after a
green build.

The step also says it signs for the three OSes. What the workflow signs is the
updater artifacts (minisign, `TAURI_SIGNING_PRIVATE_KEY`); installers are neither
signed nor notarized (OG-028).

## Scope

- Reword step 5 of `.ai/workflows/release.md`: the tag push builds the bundles,
  signs the updater artifacts and creates a **draft** release with generated
  notes and `latest.json`.
- Add an explicit publish step after the artifact check: review and edit the
  notes, then publish with `gh release edit vX.Y.Z --draft=false --latest`, and
  verify that `latest.json` at the updater endpoint reports the new version.
- Renumber the steps that follow.
- Add the ticket to `docs/tickets/README.md`.

## Acceptance criteria

- [x] Step 5 describes the draft release and what is signed, matching
      `release.yml`.
- [x] A publish step exists, with the command and the updater-endpoint check.
- [x] The failure step still says the tag is not moved.
- [x] The ticket is listed in `docs/tickets/README.md`.

## Out of scope

- Changing `release.yml` to publish automatically.
- Documenting the manual `workflow_dispatch` path.
