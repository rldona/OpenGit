# Workflow: release

> Applies from M5 onwards. Until then, there are no public artifacts.

1. `main` green (CI on the three OSes) and `ROADMAP.md` updated.
2. Update the version in `package.json` and `src-tauri/tauri.conf.json` (same version).
3. Entry in `CHANGELOG.md` (if it exists) generated from the commits since the last tag.
4. Annotated tag: `git tag -a vX.Y.Z -m "OpenGit vX.Y.Z"`.
5. Push the tag: it triggers the release workflow, which builds the bundles for macOS, Windows and Linux, signs the updater artifacts and creates a **draft** release on GitHub with generated notes and `latest.json`. The release is not public and not `Latest` until it is published in step 7.
6. Verify artifacts: install from the draft on at least one OS other than the development one and check startup, opening a repo and the graph.
7. Publish the draft: review and edit the notes, then run `gh release edit vX.Y.Z --draft=false --latest`. Check that `releases/latest/download/latest.json` reports the new version, because that is what in-app updates read.
8. If something fails: the tag is not moved. It is fixed, the patch version is bumped and `vX.Y.(Z+1)` is published.

## Versioning

- `0.x.y` until M5: may break compatibility between versions.
- `1.0.0` when the daily cycle (M1+M2) is solid.
