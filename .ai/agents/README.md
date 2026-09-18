# Agentes

Roles especializados para repartir el trabajo. Cada fichero describe misión, responsabilidades y reglas. No son agentes ejecutables de opencode: son briefs de rol que se cargan como contexto cuando una tarea toca esa área (opencode lee `AGENTS.md`; el resto es contexto que un humano o agente puede consultar).

| Agente | Área | Tickets típicos |
| --- | --- | --- |
| [git-operations](git-operations.md) | Runner de git, parseo, errores | OG-003 |
| [repository-analysis](repository-analysis.md) | Consultas de historial y estado | OG-002, OG-004, OG-009 |
| [diff](diff.md) | Diffs, casos raros de contenido | OG-005 |
| [commit](commit.md) | Panel de commit y hooks | OG-006, OG-007 |
| [branch](branch.md) | Refs, checkout, merge local | OG-008 |
| [stash](stash.md) | Ciclo de vida del stash | M3 |
| [rebase](rebase.md) | Rebase y conflictos | M4 |
| [pr](pr.md) | Pull requests vía `gh` | M5 |
| [ci](ci.md) | GitHub Actions y releases | OG-001, M5 |

Regla común a todos: las 10 reglas de [`AGENTS.md`](../../AGENTS.md) mandan sobre cualquier brief.
