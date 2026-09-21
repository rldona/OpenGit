mod support;

use opengit_lib::git::{lfs_status, lfs_track, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn lfs_configured_detects_tracked_gitattributes() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let status = lfs_status(&runner(), repo.path()).expect("lfs_status");
    assert!(!status.configured);
    assert_eq!(status.installed, status.version.is_some());

    repo.write(
        "sub/.gitattributes",
        b"# gestionados\n*.bin filter=lfs diff=lfs merge=lfs -text\n",
    );
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "lfs anidado"]);

    let status = lfs_status(&runner(), repo.path()).expect("lfs_status");
    assert!(status.configured);
}

#[test]
fn lfs_configured_ignores_comments_and_untracked() {
    let repo = TestRepo::init();
    repo.write(".gitattributes", b"# *.bin filter=lfs\n");
    repo.write("sin-trackear/.gitattributes", b"*.bin filter=lfs\n");
    repo.git_ok(&["add", ".gitattributes"]);
    repo.git_ok(&["commit", "-q", "-m", "solo comentario"]);

    let status = lfs_status(&runner(), repo.path()).expect("lfs_status");
    assert!(!status.configured);
}

#[test]
fn lfs_configured_at_root() {
    let repo = TestRepo::init();
    repo.write(
        ".gitattributes",
        b"*.psd filter=lfs diff=lfs merge=lfs -text\n",
    );
    repo.git_ok(&["add", ".gitattributes"]);
    repo.git_ok(&["commit", "-q", "-m", "lfs raiz"]);

    let status = lfs_status(&runner(), repo.path()).expect("lfs_status");
    assert!(status.configured);
}

#[test]
fn lfs_patterns_are_prefixed_with_their_directory() {
    let repo = TestRepo::init();
    repo.write(
        ".gitattributes",
        b"*.psd filter=lfs diff=lfs merge=lfs -text\n",
    );
    repo.write("sub/.gitattributes", b"*.bin filter=lfs\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "attributes"]);

    let status = lfs_status(&runner(), repo.path()).expect("lfs_status");
    assert_eq!(status.patterns, vec!["*.psd", "sub/*.bin"]);
}

#[test]
fn lfs_track_rejects_unsafe_patterns_before_running_git() {
    let repo = TestRepo::init();

    for pattern in ["  ", "--force", "with\nnewline"] {
        let error = lfs_track(&runner(), repo.path(), pattern)
            .expect_err("un patrón no válido debe fallar");
        assert!(matches!(
            error,
            opengit_lib::git::GitError::InvalidOutput { .. }
        ));
    }
}
