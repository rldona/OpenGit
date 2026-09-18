use opengit_lib::git::{parse_log, parse_numstat, parse_refs, parse_status, GitError, StatusKind};

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
