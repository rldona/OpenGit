# OG-087 · Clone and Create entry points on the home screen

- **Milestone:** M16 — Repository lifecycle
- **Status:** backlog
- **Depends on:** OG-085, OG-086, OG-079
- **References:** `src/components/RecentProjects.tsx`, `src/App.tsx`

## Context

Once cloning (OG-085) and init (OG-086) exist, they need to be reachable where
the user is when there is no repository open: the welcome screen with recent
projects (OG-079). Today it only offers "Choose folder".

## Scope

- Add **Clone…** and **Create…** actions to the home screen next to "Open".
- Route them to the Clone and Create dialogs and open the resulting repository
  in a tab.
- Mirror the actions in the native File menu if it keeps the flow consistent.

## Acceptance criteria

- [ ] From the home screen, Clone… and Create… open their dialogs.
- [ ] Finishing either flow opens the repository in a tab and it appears in the
  recents.
- [ ] The home layout stays usable with and without recent projects.
- [ ] `npm run typecheck`, `lint`, `format:check`, `test` green.

## Out of scope

- A wizard or onboarding flow.
- Drag-and-drop of a folder onto the window (separate idea).

## Technical notes

- The dialogs already own their success handling (OG-085/OG-086); the home only
  triggers them, so no new store state should be needed.
