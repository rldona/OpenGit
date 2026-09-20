---
name: hunk-staging
description: Use when implementing or fixing stage/unstage of hunks, lines or selections (git apply --cached, patch reconstruction, partial staging). Triggers on hunk, patch, index, staged, CRLF, no newline at end of file, EOF marker. Covers patch construction, --recount, reverse apply and verification.
---

# Staging by hunks with patches

## Strategy

The index is modified with a patch applied on top of `--cached`. The index is never rewritten by hand and the working tree is never touched.

```bash
git diff -U3 --no-color --no-ext-diff -- <path>        # working tree vs index
git diff --cached -U3 --no-color -- <path>             # index vs HEAD (for unstage)
git apply --cached --recount -                         # stage (patch via stdin)
git apply --cached --reverse --recount -               # unstage
```

- `--recount` recalculates the hunk counters: use it whenever you reconstruct patches.
- The patch goes via **stdin**, not via a temporary file in the repo (avoids junk and false watchers).
- `--whitespace=nowarn` so as not to surprise the user with whitespace warnings.

## Patch construction

1. Start from the original diff of the file and locate the hunk and the selected lines.
2. Keep the necessary context lines (`@@ -a,b +c,d @@`); if you trim context, recalculate headers with `--recount` or by hand.
3. Keep **the exact byte** of each line: prefixes ` `, `+`, `-` and the `\ No newline at end of file` marker in place.
4. Rebuild the `diff --git a/... b/...` block with `--- a/...` and `+++ b/...`, paths without weird quotes and without duplicated prefixes.
5. For individual lines inside a hunk, the resulting patch may split the hunk; verify with `git apply --check` before applying.

## Verification (in tests)

```bash
git diff --cached --numstat        # what ended up staged
git diff --numstat                 # what ended up unstaged
git ls-files -s -- <path>          # blob hash in the index
```

- After an unstage, the working tree must remain identical: compare `git hash-object <path>` with the expected blob.

## Cases that break patches

- **CRLF:** the diff may contain `\r`; apply as-is and don't re-normalize (respect the user's `core.autocrlf`).
- **No final newline:** the `\ No newline at end of file` marker must be attached to the affected line; without it, git adds a newline and corrupts the file.
- **New/deleted file:** use `/dev/null` on the corresponding side and `new file mode`/`deleted file mode`.
- **Paths with spaces or non-ASCII:** the `diff --git` format quotes them; with `--no-prefix` and quotes it gets complicated. Prefer `--no-color --no-ext-diff` and paths as `git diff -z` yields them for the data layer.
- **File mode:** a permission change is not a hunk; it goes in the `old mode/new mode` header.

## Anti-patterns

- Writing the patch to a file inside the repo and calling `git apply <file>`.
- Building the patch with strings without preserving the original bytes (you lose CRLF or the EOF marker).
- Applying without `--cached` (dirties the working tree) or without `--reverse` when unstaging.
- Relying on the original line count without `--recount`.
