#!/usr/bin/env bash
# Regenera los fixtures de salida real de git usados por los tests de parsers.
# Determinista: fechas, autores y locale fijos. Requiere git 2.34+.
set -euo pipefail
cd "$(dirname "$0")"
OUT="$PWD"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export TZ=UTC LC_ALL=C LANG=C
export GIT_AUTHOR_NAME="OpenGit Test" GIT_AUTHOR_EMAIL="test@opengit.dev"
export GIT_COMMITTER_NAME="OpenGit Test" GIT_COMMITTER_EMAIL="test@opengit.dev"
export GIT_AUTHOR_DATE="2026-09-18T10:00:00+00:00" GIT_COMMITTER_DATE="2026-09-18T10:00:00+00:00"

g() { git -c user.name="OpenGit Test" -c user.email="test@opengit.dev" -c commit.gpgsign=false -c core.autocrlf=false "$@"; }

# --- log: merges, refs, non-ASCII y comillas en el subject -------------------
mkdir "$work/log" && cd "$work/log"
g init -b main -q .
printf '# prueba\n' > README.md
g add .
g commit -q -m "raíz: añade README 日本"
printf 'segunda linea\n' >> README.md
g commit -q -am 'feat: cita "doble" y ñ'
g checkout -q -b feature
printf 'feature\n' > feature.txt
g add .
g commit -q -m "feat(feature): añade fichero con espacios"
g checkout -q main
printf 'linea en main\n' >> README.md
g commit -q -am "fix: linea en main"
g merge -q --no-ff feature -m "Merge branch 'feature'"
g tag -a v1.0.0 -m "release 1.0.0"
g log --topo-order --all --parents -z --format='%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s' > "$OUT/log_topo.bin"
cd "$work"

# --- status: staged, unstaged, rename, untracked, borrado y non-ASCII --------
mkdir "$work/status" && cd "$work/status"
g init -b main -q .
mkdir -p "carpeta ñ"
printf 'hola\n' > "carpeta ñ/ñandú 日本.txt"
printf 'viejo\n' > viejo.txt
printf 'borrar\n' > borrar.txt
g add .
g commit -q -m "base"
printf 'hola modificado\n' > "carpeta ñ/ñandú 日本.txt"
printf 'nuevo staged\n' > staged.txt
g add staged.txt
printf 'sin trackear\n' > untracked.txt
g mv viejo.txt renombrado.txt
printf 'renombrado y modificado\n' >> renombrado.txt
rm borrar.txt
g status --porcelain=v2 -z --branch --untracked-files=all > "$OUT/status_v2.bin"
g checkout -q --detach HEAD
g status --porcelain=v2 -z --branch --untracked-files=all > "$OUT/status_detached.bin"
cd "$work"

# --- status en repo sin commits ----------------------------------------------
mkdir "$work/initial" && cd "$work/initial"
g init -b main -q .
g status --porcelain=v2 -z --branch --untracked-files=all > "$OUT/status_initial.bin"
cd "$work"

# --- refs: local, remota (con upstream) y tags --------------------------------
mkdir "$work/refs" && cd "$work/refs"
g init -b main -q .
printf 'x\n' > x.txt
g add . && g commit -q -m "base"
g branch feature
g tag v0.1.0
g tag -a v0.2.0 -m "anotado"
g remote add origin /ruta/inexistente
g update-ref refs/remotes/origin/main HEAD
g branch --set-upstream-to=origin/main main >/dev/null
g update-ref refs/remotes/origin/feature HEAD
g for-each-ref --format='%(refname)%00%(objectname)%00%(objecttype)%00%(upstream)%00%(upstream:track)' refs/heads refs/remotes refs/tags > "$OUT/refs.bin"
cd "$work"

# --- numstat: texto, binario, rename, CRLF y sin newline final ----------------
mkdir "$work/numstat" && cd "$work/numstat"
g init -b main -q .
printf 'uno\ndos\n' > texto.txt
printf 'viejo\n' > viejo.txt
printf 'a\r\nb\r\n' > crlf.txt
printf 'sin newline final' > nonl.txt
printf '\000\001\002bin\000' > bin.bin
g add . && g commit -q -m "base"
printf 'uno\nDOS\n' > texto.txt
printf 'mas\n' >> viejo.txt
g mv viejo.txt nuevo.txt
printf 'a\r\nB\r\n' > crlf.txt
printf 'sin newline final CAMBIADO' > nonl.txt
printf '\000\003\004bin\000' > bin.bin
g add -A
g diff --cached -z -M --numstat > "$OUT/numstat.bin"
cd "$work"

echo "fixtures regenerados:"
ls -l "$OUT"/*.bin
