# Agents

Specialized roles to split the work. Each file describes a mission, responsibilities and rules. They are not executable opencode agents: they are role briefs loaded as context when a task touches that area (opencode reads `AGENTS.md`; the rest is context that a human or agent can consult).

| Agent | Area | Typical tickets |
| --- | --- | --- |
| [git-operations](git-operations.md) | Git runner, parsing, errors | OG-003 |
| [repository-analysis](repository-analysis.md) | History and status queries | OG-002, OG-004, OG-009 |
| [diff](diff.md) | Diffs, content edge cases | OG-005 |
| [commit](commit.md) | Commit panel and hooks | OG-006, OG-007 |
| [branch](branch.md) | Refs, checkout, local merge | OG-008 |
| [stash](stash.md) | Stash lifecycle | M3 |
| [rebase](rebase.md) | Rebase and conflicts | M4 |
| [pr](pr.md) | Pull requests via `gh` | M5 |
| [ci](ci.md) | GitHub Actions and releases | OG-001, M5 |

Rule common to all: the 10 rules of [`AGENTS.md`](../../AGENTS.md) override any brief.
