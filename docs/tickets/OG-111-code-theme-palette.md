# OG-111 · Add the "Code" colour palette

- **Milestone:** Next
- **Status:** ready
- **Depends on:** OG-110
- **References:** OG-110, `src/lib/theme.ts`, `src/styles/global.css`, `src/components/SettingsWindow.tsx`, `index.html`, `src/lib/i18n/messages.ts`, `src/lib/i18n/messages.es.ts`, FlupCode `packages/harness/src/styles/tokens.css`

## Context

OG-110 ported eight FlupCode palettes onto OpenGit's `data-palette` axis.
FlupCode has since added a ninth one, `code`: the neutral VS Code editor pair —
warm graphite greys with no blue cast, a periwinkle accent and the Dark Modern /
Light Modern syntax sets. This ticket brings it to OpenGit exactly like the
other paired palettes, so it follows the existing light/dark/system selector.

## Scope

- Add `code` to `PaletteName` and the `PALETTES` list in `src/lib/theme.ts`.
- A new option in the Settings → Appearance palette selector, with its i18n key
  (`paletteCode`, name "Code", not translated).
- Register `code` in the `index.html` pre-mount palette list.
- A light and a dark CSS block in `global.css` with the exact FlupCode colours,
  layered on top of `data-theme` like the other paired palettes.
- Extend the palette store/type tests with the new value.

## Acceptance criteria

- [ ] Settings → Appearance lists "Code" after Vercel.
- [ ] Selecting Code and confirming sets `data-palette="code"`; Default removes
      the attribute.
- [ ] Code has a light and a dark variant and follows the light/dark/system
      selector.
- [ ] Values are copied literally from FlupCode's `[data-fc-theme="code"]` /
      `[data-fc-theme="code"].fc-dark` blocks and mapped with the OG-110 token
      rules.
- [ ] `npm run lint`, `npm run typecheck` and `npm run test` are green.

## Out of scope

- FlupCode's Code syntax/terminal/inline-code tokens (`fc-syn-*`,
  `fc-terminal-*`, `fc-code-inline`), same as OG-110.
- Per-repository or per-window palettes.

## Technical notes

- Source colours (FlupCode `tokens.css` lines 438-507):
  - light: bg `#ffffff`, sidebar `#f3f3f3`, border `#d4d4d4`, text `#1f1f1f`,
    muted `#6e6e6e`, accent `#0b6bcb`, on-accent `#ffffff`, danger `#cf222e`,
    success `#1a7f37`, warning/favorite `#9a6700`, merged `#8250df`,
    diff-add `#1a7f37`, diff-del `#cf222e`, diff-add-bg `#2da44e`,
    diff-del-bg `#cf222e`.
  - dark: bg `#191a1b`, elevated `#202122`, sidebar `#121314`,
    border `#303132`, text `#e6e6e6`, muted `#a0a0a0`, accent `#6da5f7`,
    on-accent `#0c0c0f`, danger `#e86060`, success `#6ad57a`,
    warning/favorite `#e0b34d`, merged `#b39df3`, diff-add `#6ad57a`,
    diff-del `#ff8080`, diff-add-bg `#37b24d`, diff-del-bg `#e03131`.
- Same mapping and derivation rules as OG-110 (`--bg` ← `--fc-bg`, `--bg-panel`
  ← `--fc-sidebar`, `ref-*` from accent/merged/favorite/success, etc.). Paired
  palette, so `[data-palette="code"]` (light) and
  `[data-palette="code"][data-theme="dark"]` (dark); no `color-scheme`
  override needed.
