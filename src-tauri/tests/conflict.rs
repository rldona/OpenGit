mod support;

use opengit_lib::git::{status, Runner, StatusKind};
use opengit_lib::repo::ops::{read_worktree_file, write_and_stage};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

fn conflicted_repo() -> TestRepo {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "otro"]);
    commit_file(&repo, "a.txt", "otro\n", "cambio otro");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    let merge = repo.git(&["merge", "otro"]);
    assert!(!merge.status.success(), "must remain in conflict");
    repo
}

#[test]
fn reads_file_with_markers_and_resolves_it() {
    let repo = conflicted_repo();

    let report = status(&runner(), repo.path()).unwrap();
    assert!(report
        .entries
        .iter()
        .any(|entry| entry.path == "a.txt" && entry.kind == StatusKind::Unmerged));

    let (content, binary) = read_worktree_file(repo.path(), "a.txt").expect("read conflict");
    assert!(!binary);
    assert!(content.contains("<<<<<<<"), "{content}");
    assert!(content.contains(">>>>>>>"), "{content}");

    write_and_stage(&runner(), repo.path(), "a.txt", "resuelto\n").expect("resolve");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "resuelto\n"
    );
    let after = status(&runner(), repo.path()).unwrap();
    assert!(!after
        .entries
        .iter()
        .any(|entry| entry.kind == StatusKind::Unmerged));
    assert!(after
        .entries
        .iter()
        .any(|entry| entry.path == "a.txt" && entry.xy == "M."));
}

#[test]
fn validates_paths_and_detects_binaries() {
    let repo = conflicted_repo();

    let error = read_worktree_file(repo.path(), "../fuera.txt").expect_err("path outside");
    assert!(
        format!("{error}").contains("path outside the repository"),
        "{error}"
    );

    let error = write_and_stage(&runner(), repo.path(), "/etc/hosts", "x").expect_err("absolute");
    assert!(
        format!("{error}").contains("path outside the repository"),
        "{error}"
    );

    let bin = TestRepo::init();
    std::fs::write(bin.path().join("bin.dat"), [0xff, 0xfe, 0x00, 0x01]).unwrap();
    let (content, binary) = read_worktree_file(bin.path(), "bin.dat").expect("read binary");
    assert!(binary);
    assert!(content.is_empty());
}
