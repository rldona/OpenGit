# Workflow: ADR

## When it is needed

- Choosing or changing a structural dependency (shell, git engine, diff editor, global state).
- Defining a protocol or data model that the UI and Rust share.
- Any decision where going back implies rewriting components.

No ADR is needed for local decisions that are cheap to revert.

## Steps

1. Copy `docs/decisions/TEMPLATE.md` to `ADR-NNNN-slug.md` with the next free number.
2. Fill in context, decision, alternatives and consequences. Negative consequences are written too.
3. Initial status `proposed`; discussion in the ticket or PR.
4. Once accepted, update the status and add the row to the `docs/decisions/README.md` index.
5. If it supersedes another ADR: the old one becomes `superseded by ADR-NNNN` (its content is not edited) and they are linked.
6. Link the ADR from `AGENTS.md` if it affects daily work (stack, commands) and from the ticket that motivated it.
