# Workflow: release

> Applies from M5 onwards. Until then, there are no public artifacts.

1. `main` green (CI on the three OSes) and `ROADMAP.md` updated.
2. Update the version in `package.json` and `src-tauri/tauri.conf.json` (same version).
3. Entry in `CHANGELOG.md` (if it exists) generated from the commits since the last tag.
4. Annotated tag: `git tag -a vX.Y.Z -m "OpenGit vX.Y.Z"`.
5. Push the tag: it triggers the release workflow, which builds and signs for macOS, Windows and Linux and creates the release on GitHub.
6. Verify artifacts: install on at least one OS other than the development one and check startup, opening a repo and the graph.
7. If something fails: the tag is not moved. It is fixed, the patch version is bumped and `vX.Y.(Z+1)` is published.

## Versioning

- `0.x.y` until M5: may break compatibility between versions.
- `1.0.0` when the daily cycle (M1+M2) is solid.
