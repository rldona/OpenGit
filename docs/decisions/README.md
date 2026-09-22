# Architecture decisions (ADRs)

Record of decisions with a high cost to revert. An accepted ADR **is not edited**: it is replaced by a new one that supersedes it.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](ADR-0001-tauri-2.md) | Desktop shell based on Tauri 2 | accepted |
| [0002](ADR-0002-react-typescript.md) | React + TypeScript frontend | accepted |
| [0003](ADR-0003-git-cli-como-motor.md) | The system `git` binary as the engine | accepted |
| [0004](ADR-0004-grafo-canvas-incremental.md) | Canvas graph with incremental loading | accepted |
| [0005](ADR-0005-estado-global-zustand.md) | Global state with Zustand | accepted |
| [0006](ADR-0006-editor-diff-codemirror.md) | Diff editor based on CodeMirror 6 | accepted |
| [0007](ADR-0007-auto-updates.md) | In-app auto-updates with tauri-plugin-updater | accepted |
| [0008](ADR-0008-window-per-repository.md) | A window per repository | accepted |
| [0009](ADR-0009-i18n.md) | Internationalization with a typed in-house catalog | accepted |
| [0010](ADR-0010-run-blocking-work-off-the-main-thread.md) | Run blocking work off the main thread | accepted |

To propose a new one, copy [`TEMPLATE.md`](TEMPLATE.md) and follow the `.ai/workflows/adr.md` flow.
