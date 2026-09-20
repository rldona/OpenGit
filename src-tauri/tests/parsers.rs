use opengit_lib::git::{
    parse_blame, parse_gitattributes_paths, parse_gitattributes_uses_lfs, parse_log, parse_numstat,
    parse_refs, parse_status, parse_submodule_status, parse_worktree_list, remote_web_url,
    GitError, StatusKind, SubmoduleState,
};

const LOG_TOPO: &[u8] = include_bytes!("fixtures/log_topo.bin");
const STATUS_V2: &[u8] = include_bytes!("fixtures/status_v2.bin");
const STATUS_DETACHED: &[u8] = include_bytes!("fixtures/status_detached.bin");
const STATUS_INITIAL: &[u8] = include_bytes!("fixtures/status_initial.bin");
const REFS: &[u8] = include_bytes!("fixtures/refs.bin");
const NUMSTAT: &[u8] = include_bytes!("fixtures/numstat.bin");

#[test]
fn log_parses_merge_refs_and_non_ascii() {
    let commits = parse_log(LOG_TOPO).expect("parse log");

    assert_eq!(commits.len(), 6);
    let merge = &commits[0];
    assert_eq!(merge.parents.len(), 2);
    assert!(merge.refs.contains(&"HEAD -> main".to_string()));
    assert!(merge.refs.contains(&"tag: v1.0.0".to_string()));
    assert_eq!(merge.subject, "Merge branch 'feature'");

    let feature = commits
        .iter()
        .find(|commit| commit.refs.contains(&"feature".to_string()))
        .expect("feature branch commit");
    assert!(feature.subject.contains("añade fichero con espacios"));

    let root = commits.last().expect("root commit");
    assert!(root.parents.is_empty());
    assert!(root.subject.starts_with("raíz:"));
    assert_eq!(root.author_name, "OpenGit Test");
    assert_eq!(root.author_time, 1_789_725_600);
    assert!(root.subject.contains("日本"));
}

#[test]
fn log_parses_multiline_body_without_breaking_the_record() {
    let commits = parse_log(LOG_TOPO).expect("parse log");

    let con_cuerpo = commits
        .iter()
        .find(|commit| commit.subject == "feat: asunto con cuerpo")
        .expect("commit with a body");

    // The body contains line breaks within the same -z record.
    assert!(con_cuerpo.body.starts_with("Primera línea del cuerpo."));
    assert!(con_cuerpo.body.contains("Segunda línea con ñ y 日本."));
    assert!(con_cuerpo.body.ends_with("Refs: OG-044"));
    assert!(con_cuerpo.body.contains('\n'));

    // And the following commits are still read: the body did not eat the separator.
    assert_eq!(commits.len(), 6);
    assert!(commits.iter().all(|commit| !commit.hash.is_empty()));
    assert!(commits
        .iter()
        .any(|commit| commit.subject == "fix: linea en main"));
}

#[test]
fn log_leaves_body_empty_when_there_is_none() {
    let commits = parse_log(LOG_TOPO).expect("parse log");

    let root = commits.last().expect("root commit");
    assert_eq!(root.body, "");
}

#[test]
fn empty_log_returns_empty_list() {
    assert!(parse_log(b"").expect("empty log").is_empty());
}

#[test]
fn log_with_unexpected_format_fails() {
    assert!(matches!(
        parse_log(b"no-es-un-log"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn status_parses_header_and_all_entries() {
    let report = parse_status(STATUS_V2).expect("parse status");

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
fn detached_status_has_no_branch() {
    let report = parse_status(STATUS_DETACHED).expect("parse detached status");
    assert!(report.detached);
    assert!(report.branch.is_none());
    assert!(report.head.is_some());
    assert_eq!(report.entries.len(), 5);
}

#[test]
fn status_of_repo_without_commits() {
    let report = parse_status(STATUS_INITIAL).expect("parse initial status");
    assert!(report.head.is_none());
    assert_eq!(report.branch.as_deref(), Some("main"));
    assert!(report.entries.is_empty());
}

#[test]
fn status_with_unknown_entry_fails() {
    assert!(matches!(
        parse_status(b"x algo\0"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn refs_parses_remote_branches_tags_and_upstream() {
    let refs = parse_refs(REFS).expect("parse refs");
    assert_eq!(refs.len(), 6);

    let main = refs
        .iter()
        .find(|reference| reference.name == "refs/heads/main")
        .expect("main branch");
    assert_eq!(main.object_type, "commit");
    assert_eq!(main.upstream.as_deref(), Some("refs/remotes/origin/main"));
    assert!(main.track.is_none());

    let annotated = refs
        .iter()
        .find(|reference| reference.name == "refs/tags/v0.2.0")
        .expect("annotated tag");
    assert_eq!(annotated.object_type, "tag");
    // The annotated tag points to the peeled commit, not to the tag object.
    assert_eq!(annotated.target, "7b5940ceec35abc54a73f69bab5dfd936ba95cc5");

    let lightweight = refs
        .iter()
        .find(|reference| reference.name == "refs/tags/v0.1.0")
        .expect("lightweight tag");
    assert_eq!(lightweight.target, lightweight.object_id);

    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/heads/feature"));
    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/remotes/origin/feature"));
}

#[test]
fn refs_with_unexpected_format_fails() {
    assert!(matches!(
        parse_refs(b"solo\0dos\0"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn numstat_parses_binaries_renames_and_counters() {
    let diffs = parse_numstat(NUMSTAT).expect("parse numstat");
    assert_eq!(diffs.len(), 5);

    let binary = diffs
        .iter()
        .find(|diff| diff.path == "bin.bin")
        .expect("binary");
    assert!(binary.binary);
    assert!(binary.added.is_none());
    assert!(binary.deleted.is_none());

    let renamed = diffs
        .iter()
        .find(|diff| diff.path == "nuevo.txt")
        .expect("renamed");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));
    assert_eq!(renamed.added, Some(1));
    assert_eq!(renamed.deleted, Some(0));
    assert!(!renamed.binary);

    for path in ["crlf.txt", "nonl.txt", "texto.txt"] {
        let diff = diffs
            .iter()
            .find(|diff| diff.path == path)
            .unwrap_or_else(|| panic!("missing {path}"));
        assert_eq!(diff.added, Some(1), "{path}");
        assert_eq!(diff.deleted, Some(1), "{path}");
    }
}

#[test]
fn numstat_with_unexpected_format_fails() {
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
fn submodule_status_parses_states_and_describe() {
    let submodules = parse_submodule_status(SUBMODULE_STATUS.as_bytes()).expect("parse");

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
fn submodule_status_empty_and_errors() {
    assert!(parse_submodule_status(b"").expect("empty").is_empty());
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
fn submodule_status_with_unclosed_parenthesis_is_path() {
    let line = format!(" {} weird (path\n", "a".repeat(40));
    let submodules = parse_submodule_status(line.as_bytes()).expect("parse");
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
fn worktree_list_parses_branches_detached_locked_and_bare() {
    let worktrees = parse_worktree_list(WORKTREE_LIST.as_bytes()).expect("parse");

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
fn worktree_list_empty_and_error() {
    assert!(parse_worktree_list(b"").expect("empty").is_empty());
    assert!(matches!(
        parse_worktree_list(b"branch refs/heads/main\n"),
        Err(GitError::InvalidOutput { .. })
    ));
}

#[test]
fn gitattributes_paths_filters_only_attributes() {
    let data = b".gitattributes\0src/.gitattributes\0src/main.rs\0docs/notas.gitattributesx\0";
    let paths = parse_gitattributes_paths(data);
    assert_eq!(paths, vec![".gitattributes", "src/.gitattributes"]);
}

#[test]
fn gitattributes_uses_lfs_detects_active_lines() {
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
fn remote_web_url_converts_common_formats() {
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
fn remote_web_url_rejects_local_paths() {
    assert_eq!(remote_web_url("/tmp/repo"), None);
    assert_eq!(remote_web_url("../otro/repo"), None);
    assert_eq!(remote_web_url("file:///tmp/repo"), None);
    assert_eq!(remote_web_url("C:\\repos\\opengit"), None);
    assert_eq!(remote_web_url(""), None);
    assert_eq!(remote_web_url("git@github.com:"), None);
}

const BLAME: &str = concat!(
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2\n",
    "author Ana López\n",
    "author-mail <ana@example.com>\n",
    "author-time 1700000000\n",
    "author-tz +0000\n",
    "committer Ana López\n",
    "committer-mail <ana@example.com>\n",
    "committer-time 1700000000\n",
    "committer-tz +0000\n",
    "summary primer commit\n",
    "filename src/a.txt\n",
    "\tlet uno = 1;\n",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 2 2 1\n",
    "author Bob\n",
    "author-mail <bob@example.com>\n",
    "author-time 1700000100\n",
    "author-tz +0000\n",
    "committer Bob\n",
    "committer-mail <bob@example.com>\n",
    "committer-time 1700000100\n",
    "committer-tz +0000\n",
    "summary segundo commit\n",
    "previous aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa src/a.txt\n",
    "filename src/a.txt\n",
    "\tlet dos = 2;\n",
);

#[test]
fn blame_porcelain_parses_one_row_per_line() {
    let lines = parse_blame(BLAME.as_bytes()).expect("parse blame");

    assert_eq!(lines.len(), 2);
    assert_eq!(lines[0].line, 1);
    assert_eq!(lines[0].hash, "a".repeat(40));
    assert_eq!(lines[0].author_name, "Ana López");
    assert_eq!(lines[0].author_email, "ana@example.com");
    assert_eq!(lines[0].author_time, 1_700_000_000);
    assert_eq!(lines[0].content, "let uno = 1;");

    assert_eq!(lines[1].line, 2);
    assert_eq!(lines[1].hash, "b".repeat(40));
    assert_eq!(lines[1].author_name, "Bob");
    assert_eq!(lines[1].content, "let dos = 2;");
}

#[test]
fn blame_strips_boundary_marker_and_keeps_empty_content() {
    let data = concat!(
        "^cccccccccccccccccccccccccccccccccccccccc 1 1 1\n",
        "author Carol\n",
        "author-mail <carol@example.com>\n",
        "author-time 1700000200\n",
        "summary borde\n",
        "\t\n",
    );

    let lines = parse_blame(data.as_bytes()).expect("parse");

    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0].hash, "c".repeat(40), "the ^ marker is stripped");
    assert_eq!(lines[0].content, "");
}
