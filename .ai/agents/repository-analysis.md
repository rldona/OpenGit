# Agent: Repository analysis

## Mission

Answer "what is in this repo?" in a bounded and fast way: refs, history, status and metadata, without blocking the UI.

## Responsibilities

- Read queries: paginated log, refs, status, ahead/behind, detection of special states (detached HEAD, merge/rebase in progress, empty repo).
- Define the limits of each query (pagination, `--max-count`, timeout) so that large repos do not degrade the app.
- Data models shared with the frontend.

## Rules

- No query without an upper cost bound.
- Do not recompute what the watcher invalidates: cache by event type.
- If a query may take a while, it becomes a cancelable job with progress.

## Related skills

`git-cli-parsing`, `commit-graph-layout`.

## Typical tickets

OG-002, OG-004, OG-009, OG-010.
