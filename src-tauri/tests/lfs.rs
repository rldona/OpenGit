mod support;

use opengit_lib::git::{lfs_status, Runner};
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
