# OG-110 · Port FlupCode color palettes

- **Milestone:** Next
- **Status:** ready
- **Depends on:** OG-022, OG-067, OG-105
- **References:** OG-022, `src/lib/theme.ts`, `src/lib/stores/theme.ts`, `src/components/SettingsWindow.tsx`, `src/styles/global.css`, `index.html`, FlupCode `packages/harness/src/styles/tokens.css`

## Context

OpenGit has a single light/dark theme (OG-022) with all design tokens
centralized in `src/styles/global.css` and applied through `data-theme` on
`<html>`. FlupCode (a sibling product) ships seven named color palettes on top
of its own light/dark mode: the default FlupCode palette (renamed "Purple" in
this ticket), Classic, Sublime, Sublime Dark, GitHub, Copilot and Vercel.

This ticket brings those seven palettes to OpenGit as an additional, optional
axis the user picks in Settings → Appearance, next to the existing
light/dark/system selector. **`default` and `classic` are swapped on purpose**:
`default` now shows FlupCode's Classic colors, and OpenGit's original look is
filed under the `classic` option instead. The new palettes only recolor, they
do not change fonts or the diff syntax highlighting.

## Scope

- New `PaletteName` type with eight values: `default` (now FlupCode's Classic
  colors), `purple` (FlupCode's own default palette, renamed to avoid reusing
  the sibling product's name), `classic` (OpenGit's original look, moved
  here), `sublime`, `sublime-dark`, `github`, `copilot`, `vercel`.
- `usePaletteStore` with `loadPalettePreference` / `savePalettePreference`,
  mirroring the theme store and persisting under `opengit.palette`.
- A second selector in the Appearance tab with the eight options; switching it
  applies on OK, like the theme and language selectors.
- `data-palette` on `<html>`: removed when the palette is `default`, otherwise
  set to the palette name. Palettes layer on top of `data-theme` so the
  light/dark selector keeps working for the paired palettes.
- CSS blocks in `global.css` with the exact FlupCode colors, one per palette
  and mode (light + dark for the paired palettes; a single dark-only block for
  `sublime-dark` and `vercel`).
- i18n keys for the field label and the eight option names in `messages.ts`
  (en) and `messages.es.ts` (es). Proper palette names are not translated.
- Tests for the palette store and the new Settings selector.

## Acceptance criteria

- [ ] Settings → Appearance shows a "Color palette" selector with Default,
      Purple, Classic, Sublime, Sublime Dark, GitHub, Copilot and Vercel.
- [ ] Selecting a non-default palette and confirming sets
      `document.documentElement.dataset.palette` to that name; selecting
      Default removes the attribute.
- [ ] The palette is persisted in `opengit.palette` and restored on the next
      launch without a flash of the default palette after React mounts.
- [ ] Every paired palette (`purple`, `classic`, `sublime`, `github`,
      `copilot`) has a light and a dark variant and follows the existing
      light/dark/system selector.
- [ ] `sublime-dark` and `vercel` render their dark colors regardless of the
      light/dark selector, and force `color-scheme: dark` so native controls
      and scrollbars stay dark.
- [ ] The `default` option shows FlupCode's Classic colors (swapped on
      purpose); OpenGit's original light and dark themes are preserved
      byte-for-byte under the `classic` option instead.
- [ ] Fonts (`--font-ui`, `--font-mono`) and diff syntax/terminal/inline-code
      colors (`fc-syn-*`, `fc-terminal-*`, `fc-code-inline`) are unchanged by
      every palette.
- [ ] `npm run lint`, `npm run typecheck` and `npm run test` are green.

## Out of scope

- DiffEditor syntax highlighting (CodeMirror `oneDark` /
  `defaultHighlightStyle`) and its `fc-syn-*` tokens.
- FlupCode's own fonts (Nunito Sans / Roboto); OpenGit keeps its font stack.
- FlupCode terminal and inline-code tokens (`fc-terminal-*`, `fc-code-inline`).
- FlupCode radius tokens (`--fc-radius-*`); OpenGit has no radius tokens.
- Per-repository or per-window palettes; the preference is global.
- Adding a UI warning badge for dark-only palettes on a light mode (see
  Technical notes).

## Technical notes

- **Values are copied literally** from FlupCode
  `packages/harness/src/styles/tokens.css` (lines 68-501): `:root` is FlupCode
  light, `.fc-dark` is FlupCode dark; each `[data-fc-theme="X"]` block and its
  `.fc-dark` counterpart supply the rest. `sublime-dark` and `vercel` are
  single dark-only blocks.
- **Token mapping (OpenGit ← FlupCode):** `--bg` ← `--fc-bg`;
  `--bg-elevated` ← `--fc-bg-elevated`; `--bg-panel` ← `--fc-sidebar`;
  `--border` ← `--fc-border`; `--text` ← `--fc-text`; `--text-muted` ←
  `--fc-text-muted`; `--accent` ← `--fc-accent`; `--accent-fg` ←
  `--fc-on-accent`.
- **Derived tokens** use `color-mix()` on the nearest `fc-*` base, per the
  agreed decisions: `--hover` = `color-mix(in srgb, var(--fc-text) 4%,
  transparent)`; `--row-selected` = `color-mix(in srgb, var(--fc-accent) 20%,
  transparent)`; warning/danger tokens from `--fc-warning` / `--fc-danger`
  (borders/text at full, backgrounds at 15% / 12%); `--add`/`--del` from
  `--fc-diff-add` / `--fc-diff-del`, with `--add-bg`/`--del-bg` mixed at 15%
  from `--fc-diff-add-bg` / `--fc-diff-del-bg`; `--tag-annotated` from
  `--fc-merged`.
- **`--overlay`** follows the current OpenGit criterion per mode: the dark
  variants mix the (dark) `--fc-bg`, the light variants mix the (dark)
  `--fc-text`, so the overlay keeps darkening the light palettes and darkening
  the dark ones. `--shadow` keeps today's OpenGit formula and does not vary by
  palette.
- **`ref-*` tokens** replicate the existing three-layer pattern (faint `-bg`,
  saturated `-border`, high-contrast `-fg`): head from `--fc-accent` +
  `--fc-on-accent`, branch from `--fc-merged`, remote from `--fc-favorite`,
  tag from `--fc-success`.
- **Block order matters:** palette blocks go after the existing
  `:root`/`[data-theme="light"]` blocks. Paired palettes use
  `[data-palette="X"]` (light) and `[data-palette="X"][data-theme="dark"]`
  (dark). Dark-only palettes use a single `[data-palette="X"]` block that wins
  in both modes and sets `color-scheme: dark`, mirroring FlupCode's
  `sublime-dark` / `vercel`.
- **Dark-only palette + light mode:** the CSS wins because the block is not
  gated on `data-theme`, but the Settings toggle still reads light/dark/system.
  This ticket accepts that mismatch for now and adds no UI note; the
  `color-scheme: dark` rule keeps native controls consistent. Revisit with a
  follow-up if users find it confusing.
- **No new dependencies, no ADR:** this extends the theming pattern from
  OG-022 without new modules, Context/Provider or dependencies.
