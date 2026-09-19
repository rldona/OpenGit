# Performance

## Graph: pure layout + viewport canvas + virtualized rows

- **Date:** 2026-09-18
- **Context:** OG-004 required smoothness with 10,000 commits (SourceTree's weak spot).
- **Decisions that matter:**
  - Lane layout is a pure and incremental function (`src/lib/graph/layout.ts`) with state passed between pages; what's already painted is not recalculated.
  - Lanes have an **id** and the color lives in a separate map (`colors`), so a branch discovered later (its tip arrives on another page) repaints its whole line without mutating rows.
  - The canvas draws only the viewport's rows (overscan of 1) and repaints on every scroll; the DOM list only mounts ~viewport + 12 rows.
  - 10,000-commit test in one lane: the layout is linear in the number of commits and passes in milliseconds.
- **Implication:** any change must keep the layout incremental and not introduce work per total row. If a third type of edge is added, extend `GraphEdge.kind` instead of duplicating logic in the render.

## Diff with CodeMirror 6

- **Date:** 2026-09-18
- **Context:** OG-005; files of thousands of lines without blocking the UI.
- **Design:** the git patch is requested only for the selected file; `splitPatch` divides it into two documents for `MergeView` (side by side with collapsing of unchanged runs) or it is shown as-is with per-line decorations (unified). Languages are loaded on demand with `@codemirror/language-data`; if the extension is unknown, nothing is loaded.
- **Finding:** the main bundle exceeds 500 kB and Vite warns (CodeMirror + language descriptions). It doesn't break anything; if it becomes annoying, split out `DiffEditor` with a dynamic `import()` so the editor chunk doesn't load on first paint.
- **Implication:** don't compute diffs on the frontend; only present git's patch. The full patch is kept in the store so OG-006 can split it into hunks.
