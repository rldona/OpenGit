# OG-114 · Offer to remove the worktree that blocks a branch delete

- **Milestone:** Next
- **Status:** done
- **Depends on:** OG-113
- **References:** OG-113, OG-058, `src/lib/stores/refs.ts`, `src/components/RefsSidebar.tsx`

## Context

OG-113 explains that a branch cannot be deleted because another worktree has it
checked out. The user still has to find that worktree and remove it by hand.

## Scope

- When the delete is blocked, the error shows a "Remove worktree and delete
  branch" button.
- It asks for confirmation (`worktree.removeConfirm`), runs `worktree remove`, and
  on a dirty worktree asks the same second confirmation as the Worktrees section
  before forcing.
- On success it refreshes the worktree list and retries the branch delete.

## Acceptance criteria

- [x] The blocked-delete message shows the button.
- [x] Declining any confirmation changes nothing.
- [x] After removal the branch delete is retried (a not-fully-merged branch still
      goes through the usual force-delete confirmation).
- [x] Vitest tests; i18n keys in `en` and `es`.
- [x] `npm run lint`, `npm run typecheck` and `npm run test` are green.

## Out of scope

- Switching the other worktree to another branch instead of removing it.
