# Fixtures de git

Salidas reales de `git` capturadas byte a byte, usadas por los unit tests de los parsers. No tocan disco ni red en los tests: se cargan con `include_bytes!`.

Se regeneran con:

```bash
src-tauri/tests/fixtures/generate.sh
```

El script es determinista (fechas, autor y locale fijos) y requiere git 2.34+. Si cambia el formato de git, se regeneran y se revisa que los tests sigan pasando.

| Fixture | Comando | Cubre |
| --- | --- | --- |
| `log_topo.bin` | `git log --topo-order --all --parents -z --format=...` | merge, root, refs, non-ASCII, comillas |
| `status_v2.bin` | `git status --porcelain=v2 -z --branch` | staged, unstaged, rename, untracked, borrado, non-ASCII |
| `status_detached.bin` | idem en detached HEAD | detached HEAD |
| `status_initial.bin` | idem en repo sin commits | repo vacío |
| `refs.bin` | `git for-each-ref --format=...` | ramas, remota con upstream, tags anotados y ligeros |
| `numstat.bin` | `git diff --cached -z -M --numstat` | binario, rename, CRLF, sin newline final |
