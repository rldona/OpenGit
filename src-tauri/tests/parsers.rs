use opengit_lib::git::{
    parse_gitattributes_paths, parse_gitattributes_uses_lfs, parse_log, parse_numstat, parse_refs,
    parse_status, parse_submodule_status, parse_worktree_list, remote_web_url, GitError,
    StatusKind, SubmoduleState,
};

const LOG_TOPO: &[u8] = include_bytes!("fixtures/log_topo.bin");
const STATUS_V2: &[u8] = include_bytes!("fixtures/status_v2.bin");
const STATUS_DETACHED: &[u8] = include_bytes!("fixtures/status_detached.bin");
const STATUS_INITIAL: &[u8] = include_bytes!("fixtures/status_initial.bin");
const REFS: &[u8] = include_bytes!("fixtures/refs.bin");
const NUMSTAT: &[u8] = include_bytes!("fixtures/numstat.bin");

#[test]
fn log_parsea_merge_refs_y_non_ascii() {
    let commits = parse_log(LOG_TOPO).expect("parsear log");

    assert_eq!(commits.len(), 5);
    let merge = &commits[0];
    assert_eq!(merge.parents.len(), 2);
    assert!(merge.refs.contains(&"HEAD -> main".to_string()));
    assert!(merge.refs.contains(&"tag: v1.0.0".to_string()));
    assert_eq!(merge.subject, "Merge branch 'feature'");

    let feature = commits
        .iter()
        .find(|commit| commit.refs.contains(&"feature".to_string()))
        .expect("commit de la rama feature");
    assert!(feature.subject.contains("añade fichero con espacios"));

    let root = commits.last().expect("commit raíz");
    assert!(root.parents.is_empty());
    assert!(root.subject.starts_with("raíz:"));
    assert_eq!(root.author_name, "OpenGit Test");
    assert_eq!(root.author_time, 1_789_725_600);
    assert!(root.subject.contains("日本"));
}

#[test]
fn log_vacio_devuelve_lista_vacia() {
    assert!(parse_log(b"").expect("log vacío").is_empty());
}

#[test]
fn log_con_formato_inesperado_falla() {
    assert!(matches!(
        parse_log(b"no-es-un-log"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn status_parsea_cabecera_y_todas_las_entradas() {
    let report = parse_status(STATUS_V2).expect("parsear status");

    assert_eq!(report.branch.as_deref(), Some("main"));
    assert!(!report.detached);
    assert!(report.head.is_some());
    assert!(report.upstream.is_none());
    assert_eq!(report.entries.len(), 5);

    assert_eq!(report.entries[0].kind, StatusKind::Ordinary);
    assert_eq!(report.entries[0].xy, ".D");
    assert_eq!(report.entries[0].path, "borrar.txt");

    assert_eq!(report.entries[1].xy, ".M");
    assert_eq!(report.entries[1].path, "carpeta ñ/ñandú 日本.txt");

    let renamed = &report.entries[2];
    assert_eq!(renamed.kind, StatusKind::Renamed);
    assert_eq!(renamed.xy, "RM");
    assert_eq!(renamed.path, "renombrado.txt");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));

    assert_eq!(report.entries[3].kind, StatusKind::Ordinary);
    assert_eq!(report.entries[3].xy, "A.");
    assert_eq!(report.entries[4].kind, StatusKind::Untracked);
    assert_eq!(report.entries[4].path, "untracked.txt");
}

#[test]
fn status_detached_no_tiene_rama() {
    let report = parse_status(STATUS_DETACHED).expect("parsear status detached");
    assert!(report.detached);
    assert!(report.branch.is_none());
    assert!(report.head.is_some());
    assert_eq!(report.entries.len(), 5);
}

#[test]
fn status_de_repo_sin_commits() {
    let report = parse_status(STATUS_INITIAL).expect("parsear status inicial");
    assert!(report.head.is_none());
    assert_eq!(report.branch.as_deref(), Some("main"));
    assert!(report.entries.is_empty());
}

#[test]
fn status_con_entrada_desconocida_falla() {
    assert!(matches!(
        parse_status(b"x algo\0"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn refs_parsea_ramas_remotas_tags_y_upstream() {
    let refs = parse_refs(REFS).expect("parsear refs");
    assert_eq!(refs.len(), 6);

    let main = refs
        .iter()
        .find(|reference| reference.name == "refs/heads/main")
        .expect("rama main");
    assert_eq!(main.object_type, "commit");
    assert_eq!(main.upstream.as_deref(), Some("refs/remotes/origin/main"));
    assert!(main.track.is_none());

    let annotated = refs
        .iter()
        .find(|reference| reference.name == "refs/tags/v0.2.0")
        .expect("tag anotado");
    assert_eq!(annotated.object_type, "tag");

    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/heads/feature"));
    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/remotes/origin/feature"));
}

#[test]
fn refs_con_formato_inesperado_falla() {
    assert!(matches!(
        parse_refs(b"solo\0dos\0"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn numstat_parsea_binarios_renombrados_y_contadores() {
    let diffs = parse_numstat(NUMSTAT).expect("parsear numstat");
    assert_eq!(diffs.len(), 5);

    let binary = diffs
        .iter()
        .find(|diff| diff.path == "bin.bin")
        .expect("binario");
    assert!(binary.binary);
    assert!(binary.added.is_none());
    assert!(binary.deleted.is_none());

    let renamed = diffs
        .iter()
        .find(|diff| diff.path == "nuevo.txt")
        .expect("renombrado");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));
    assert_eq!(renamed.added, Some(1));
    assert_eq!(renamed.deleted, Some(0));
    assert!(!renamed.binary);

    for path in ["crlf.txt", "nonl.txt", "texto.txt"] {
        let diff = diffs
            .iter()
            .find(|diff| diff.path == path)
            .unwrap_or_else(|| panic!("falta {path}"));
        assert_eq!(diff.added, Some(1), "{path}");
        assert_eq!(diff.deleted, Some(1), "{path}");
    }
}

#[test]
fn numstat_con_formato_inesperado_falla() {
    assert!(matches!(
        parse_numstat(b"1\t2\0"),
        Err(GitError::InvalidOutput { .. })
    ));
}

const SUBMODULE_STATUS: &str = concat!(
    " 3bf01e312f333ee5aaaec23656a0809ff381da58 vendor/lib con espacio (heads/main)\n",
    "+3c8ad3c5346b0eaebe648460a94e56d8048af540 otro (v1.2.3)\n",
    "-abcdef0123456789abcdef0123456789abcdef01 sin-inicializar\n",
    "U0123456789abcdef0123456789abcdef01234567 conflicto\n",
);

#[test]
fn submodule_status_parsea_estados_y_describe() {
    let submodules = parse_submodule_status(SUBMODULE_STATUS.as_bytes()).expect("parsear");

    assert_eq!(submodules.len(), 4);

    let clean = &submodules[0];
    assert_eq!(clean.path, "vendor/lib con espacio");
    assert_eq!(clean.state, SubmoduleState::Clean);
    assert_eq!(clean.describe.as_deref(), Some("heads/main"));
    assert_eq!(clean.head.len(), 40);

    let modified = &submodules[1];
    assert_eq!(modified.state, SubmoduleState::Modified);
    assert_eq!(modified.describe.as_deref(), Some("v1.2.3"));

    let uninitialized = &submodules[2];
    assert_eq!(uninitialized.state, SubmoduleState::Uninitialized);
    assert_eq!(uninitialized.describe, None);

    assert_eq!(submodules[3].state, SubmoduleState::Conflict);
}

#[test]
fn submodule_status_vacio_y_errores() {
    assert!(parse_submodule_status(b"").expect("vacío").is_empty());
    assert!(matches!(
        parse_submodule_status(b"sin-formato\n"),
        Err(GitError::InvalidOutput { .. })
    ));
    let unknown_state = format!("X{} path\n", "0".repeat(40));
    assert!(matches!(
        parse_submodule_status(unknown_state.as_bytes()),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn submodule_status_con_parentesis_sin_cerrar_es_path() {
    let line = format!(" {} weird (path\n", "a".repeat(40));
    let submodules = parse_submodule_status(line.as_bytes()).expect("parsear");
    assert_eq!(submodules[0].path, "weird (path");
    assert_eq!(submodules[0].describe, None);
}

const WORKTREE_LIST: &str = concat!(
    "worktree /repo/main\nHEAD 4548364992033545b5291a9883214f55ac7b6c94\nbranch refs/heads/main\n\n",
    "worktree /repo/detached\nHEAD 4548364992033545b5291a9883214f55ac7b6c94\ndetached\n\n",
    "worktree /repo/locked\nHEAD 4548364992033545b5291a9883214f55ac7b6c94\nbranch refs/heads/locked\nlocked mantenimiento\n\n",
    "worktree /repo/bare\nHEAD 4548364992033545b5291a9883214f55ac7b6c94\nbare\n",
);

#[test]
fn worktree_list_parsea_ramas_detached_locked_y_bare() {
    let worktrees = parse_worktree_list(WORKTREE_LIST.as_bytes()).expect("parsear");

    assert_eq!(worktrees.len(), 4);
    assert_eq!(worktrees[0].path, "/repo/main");
    assert_eq!(worktrees[0].branch.as_deref(), Some("refs/heads/main"));
    assert!(!worktrees[0].detached && !worktrees[0].bare && !worktrees[0].locked);

    assert!(worktrees[1].detached);
    assert_eq!(worktrees[1].branch, None);

    assert!(worktrees[2].locked);
    assert_eq!(worktrees[2].branch.as_deref(), Some("refs/heads/locked"));

    assert!(worktrees[3].bare);
}

#[test]
fn worktree_list_vacio_y_error() {
    assert!(parse_worktree_list(b"").expect("vacío").is_empty());
    assert!(matches!(
        parse_worktree_list(b"branch refs/heads/main\n"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn gitattributes_paths_filtra_solo_los_atributos() {
    let data = b".gitattributes\0src/.gitattributes\0src/main.rs\0docs/notas.gitattributesx\0";
    let paths = parse_gitattributes_paths(data);
    assert_eq!(paths, vec![".gitattributes", "src/.gitattributes"]);
}

#[test]
fn gitattributes_uses_lfs_detecta_lineas_activas() {
    assert!(parse_gitattributes_uses_lfs(
        b"*.bin filter=lfs diff=lfs merge=lfs -text\n"
    ));
    assert!(parse_gitattributes_uses_lfs(
        b"# comentario\nvideos/** filter=lfs\n"
    ));
    assert!(parse_gitattributes_uses_lfs(b"  *.bin   filter=lfs  \n"));
    assert!(!parse_gitattributes_uses_lfs(b"# *.bin filter=lfs\n"));
    assert!(!parse_gitattributes_uses_lfs(b"*.txt text\n"));
    assert!(!parse_gitattributes_uses_lfs(b""));
}

#[test]
fn remote_web_url_convierte_los_formatos_habituales() {
    assert_eq!(
        remote_web_url("https://github.com/rldona/opengit.git").as_deref(),
        Some("https://github.com/rldona/opengit")
    );
    assert_eq!(
        remote_web_url("https://gitlab.com/grupo/sub/repo/").as_deref(),
        Some("https://gitlab.com/grupo/sub/repo")
    );
    assert_eq!(
        remote_web_url("git@github.com:rldona/opengit.git").as_deref(),
        Some("https://github.com/rldona/opengit")
    );
    assert_eq!(
        remote_web_url("ssh://git@gitlab.com/grupo/repo.git").as_deref(),
        Some("https://gitlab.com/grupo/repo")
    );
    assert_eq!(
        remote_web_url("ssh://git@host:2222/grupo/repo.git").as_deref(),
        Some("https://host/grupo/repo")
    );
    assert_eq!(
        remote_web_url("git://host/grupo/repo.git").as_deref(),
        Some("https://host/grupo/repo")
    );
}

#[test]
fn remote_web_url_rechaza_rutas_locales() {
    assert_eq!(remote_web_url("/tmp/repo"), None);
    assert_eq!(remote_web_url("../otro/repo"), None);
    assert_eq!(remote_web_url("file:///tmp/repo"), None);
    assert_eq!(remote_web_url("C:\\repos\\opengit"), None);
    assert_eq!(remote_web_url(""), None);
    assert_eq!(remote_web_url("git@github.com:"), None);
}
