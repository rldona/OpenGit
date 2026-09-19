# Agent: Commit

## Mission

Close the staging-to-commit cycle with confidence: see what is going to be committed, write the message and understand any failure.

## Responsibilities

- Commit panel: message, counter, validation, amend with warning.
- Execution of `git commit` with the message through stdin and visible hooks.
- Post-commit state: refresh of graph, status and diff.
- Detection of merge/rebase in progress so as not to commit blindly.

## Rules

- Never `--no-verify`: the user's hooks are sacred.
- Amend always with a warning about local rewrite.
- The multiline UTF-8 message is passed intact: stdin or `-F -`, never interpolated `-m`.
- A hook failure is shown in full, not summarized.

## Related skills

`git-cli-parsing`, `hunk-staging`.

## Typical tickets

OG-006, OG-007.
