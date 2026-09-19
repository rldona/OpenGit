# Workflow: new feature

1. **Ticket first.** If `OG-NNN` does not exist, create it in `docs/tickets/` with context, scope and acceptance criteria. No ticket, no branch.
2. **Status and dependencies.** Check that its dependencies are `done`. Move it to `in-progress` and update the `docs/tickets/README.md` index.
3. **Branch.** `feat/OG-NNN-slug` (or `fix/`, `chore/`, `docs/`).
4. **Consult context.** Read `docs/architecture/overview.md`, the applicable ADRs and the skills for the area (`.ai/skills/`). If the task touches an area with a defined agent (`.ai/agents/`), load its brief.
5. **Implement vertically.** Minimal change that meets the criteria; tests at the same time, not afterwards.
6. **Verify.**

   ```bash
   npm run lint && npm run typecheck && npm run test
   cargo test --manifest-path src-tauri/Cargo.toml
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   ```

7. **Close.** Ticket to `done`, update the index. Commit(s) in Conventional Commits with scope. PR with `Closes OG-NNN`.
8. **Memory.** If you learned something non-obvious (git, platform, performance), note it in `.ai/memory/`.

Golden rule: if during the implementation you discover that the ticket was badly defined, the ticket is fixed before continuing; scope is not improvised.
