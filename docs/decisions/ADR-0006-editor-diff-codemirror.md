# ADR-0006 · Diff editor based on CodeMirror 6

- **Status:** accepted
- **Date:** 2026-09-18
- **Deciders:** Raúl López

## Context

The diff view needs: unified and side-by-side modes, syntax highlighting per
language, line numbers, smooth scrolling with files of thousands of lines and
full control of the theme (our own CSS). Everything must work offline inside the
webview, without external services.

## Decision

Use **CodeMirror 6** (`@codemirror/state`, `@codemirror/view`,
`@codemirror/language`, `@codemirror/merge` and `@codemirror/language-data`) as
the presentation layer. **Git remains the source of truth**: the diff content is
the patch returned by `git diff`; CodeMirror does not compute the diff, it only
paints it.

## Alternatives considered

- **Monaco** — heavier (several MB), designed for VS Code-style editing; its
  theming is more rigid and it adds nothing for a read-only viewer.
- **Custom renderer with highlighting (Shiki/Prism)** — virtualization, folding
  and alignment would have to be reimplemented; much more code for a worse
  result.
- **Diff computed in the frontend (e.g. jsdiff's `diff`)** — would duplicate
  git's logic and could diverge from what is going to be staged (OG-006).
  Discarded by ADR-0003.

## Consequences

- The bundle grows (CodeMirror 6 ~400 KB across all packages) but languages are
  loaded on demand with `@codemirror/language-data`; acceptable in a desktop app.
- The visual alignment of side-by-side mode is computed by CodeMirror over the
  two documents derived from the patch: it may differ cosmetically from git's
  hunk grouping; the content (and what is staged) is still git's.
- Unified mode shows the git patch as is, with per-line colour decorations
  (`+`/`-`), without reinterpreting it.
- Switching editors later would have a high cost: it would require another ADR
  superseding this one.
