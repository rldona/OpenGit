---
name: commit-graph-layout
description: Use when implementing or debugging the commit graph lanes in the log view (lane assignment, incremental layout, canvas rendering, HiDPI). Triggers on grafo, lanes, graph, commit graph, canvas, topo-order, parents, merges. Covers the lane algorithm, stable colors and performance rules.
---

# Commit graph layout

## Input and output

- Input: commits in reverse topological order (new → old), each with `hash` and `parents`.
- Output: for each commit, its **lane** (column) and the **edges** towards its parents, with the source and destination lane. The layout must be a pure function `commits -> layout`, testable without canvas.

## Base algorithm (incremental)

1. Keep a `lanes` array with the hash of the commit that each lane expects as next (the "expectation").
2. For commit `C`:
   - If `C` is in `lanes[i]`, its lane is `i`.
   - If not (new branch), open a free lane or append one at the end.
3. Replace `lanes[i]` with the first parent of `C`. Additional parents (merges) occupy new or existing lanes with their hash.
4. Lanes whose hash will no longer appear are closed at the end of the page; don't reorder open lanes (it causes visual jumps).
5. When loading the next page, continue the state (`lanes`) instead of recomputing everything.

## Colors

- The color is associated with the **branch/ref**, not with the lane index (lanes are reused and would change color).
- A stable color hash (e.g. by branch name) that doesn't depend on arrival order.
- In merges, the commit's color is that of its first lane; edges keep the color of the lane they come from.

## Rendering

- Canvas 2D only for the viewport (+ a row margin). Virtualized DOM rows for selection and accessibility (`aria-hidden` on the canvas).
- Fixed row height; `y = index * rowHeight - scrollTop`.
- `devicePixelRatio`: canvas size in physical pixels and `ctx.scale(dpr, dpr)` for crisp strokes.
- Merge curves with `quadraticCurveTo` or arcs; unconnected crossings are drawn as a "bridge" breaking the line.
- Don't redraw everything when the selection changes: separate selection/HUD layer or repaint only the affected rows.

## Tests

Minimum layout cases: linear, single root, simple merge, merge of two branches that continue, octopus, multiple roots (orphan history), branch born from an old commit, and incremental loads by pages whose boundaries fall in the middle of a merge.

## Anti-patterns

- `O(n²)` searching the hash in all lanes: index by hash → lane.
- Recomputing the complete layout when paginating.
- Drawing all commits in the DOM.
- Colors by lane index.
- Measuring text inside the paint loop.
