# CI

## macOS is billed 10× on GitHub Actions

- **Date:** 2026-09-18
- **Context:** OG-001 ran frontend + Rust + build on macOS, Ubuntu and Windows on every push to the PR (~8–9 min wall clock).
- **Finding:** GitHub Actions bills macOS at 10× and Windows at 2× the Linux minutes. Building on the three OSes was the bottleneck, not the validation itself (frontend 15 s, Rust 2m44s).
- **Implication:** OG-012 split the workflows: `ci.yml` (frontend + Rust, Ubuntu only) on every PR and `build.yml` (`workflow_dispatch`, 3-OS matrix, `--no-bundle`, artifacts) on demand. Review if the billing policy changes.

## paths-ignore and required checks

- **Date:** 2026-09-18
- **Context:** filtering commits that only touch docs in `ci.yml`.
- **Finding:** with `paths-ignore`, a docs-only change doesn't trigger the workflow; if required checks were configured, the merge would sit waiting for a check that never arrives.
- **Implication:** right now there is no branch protection, so it's safe. If it's enabled, remove the filter or replace it with a lightweight change-detection job.

## Flaky watcher test in CI

- **Date:** 2026-09-18
- **Context:** PR #34 (UI only) failed in the Rust job with `watch::la_pausa_silencia_los_cambios_propios` ("must not emit while paused").
- **Finding:** the test depends on the real timing of inotify/FSEvents and can fail without code changes; `gh run rerun --failed` passed on the first try.
- **Implication:** on that failure, rerun before suspecting the change. If it repeats, make it deterministic (wait for the first event with a longer timeout instead of sleeping a fixed amount).
