mod support;

use std::path::Path;

use opengit_lib::git::{apply_patch, format_patch, Runner};
use support::{TempDir, TestRepo};

fn runner() -> Runner {
    Runner::locate()
}

fn hash(repo: &TestRepo, rev: &str) -> String {
    String::from_utf8_lossy(&repo.git(&["rev-parse", rev]).stdout)
        .trim()
        .to_string()
}

fn commit(repo: &TestRepo, file: &str, content: &str, message: &str) {
    repo.write(file, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

#[test]
fn format_patch_exports_a_single_commit() {
    let repo = TestRepo::init();
    commit(&repo, "a.txt", "a\n", "first");
    commit(&repo, "a.txt", "b\n", "second");
    let head = hash(&repo, "HEAD");
    let out = TempDir::new("patch-single");

    let files =
        format_patch(&runner(), repo.path(), &head, true, out.path()).expect("format-patch");

    assert_eq!(files.len(), 1, "{files:?}");
    assert!(Path::new(&files[0]).is_file());
}

#[test]
fn format_patch_exports_a_range() {
    let repo = TestRepo::init();
    commit(&repo, "a.txt", "a\n", "first");
    commit(&repo, "a.txt", "b\n", "second");
    let first = hash(&repo, "HEAD~1");
    let out = TempDir::new("patch-range");

    let files =
        format_patch(&runner(), repo.path(), &first, false, out.path()).expect("format-patch");

    assert_eq!(files.len(), 1, "{files:?}");
}

#[test]
fn apply_patch_recreates_a_commit_from_a_mailbox() {
    let repo = TestRepo::init();
    commit(&repo, "a.txt", "a\n", "first");
    commit(&repo, "b.txt", "b\n", "add b");
    let head = hash(&repo, "HEAD");
    let out = TempDir::new("patch-am");
    let files =
        format_patch(&runner(), repo.path(), &head, true, out.path()).expect("format-patch");

    // Drop the commit and re-apply it with `git am`.
    repo.git_ok(&["reset", "--hard", "HEAD~1"]);
    assert!(!repo.path().join("b.txt").exists());

    apply_patch(&runner(), repo.path(), Path::new(&files[0]), true, false).expect("git am");

    assert!(repo.path().join("b.txt").exists());
    let subject = String::from_utf8_lossy(&repo.git(&["log", "-1", "--format=%s"]).stdout)
        .trim()
        .to_string();
    assert_eq!(subject, "add b");
}

#[test]
fn apply_patch_applies_a_plain_diff() {
    let repo = TestRepo::init();
    commit(&repo, "a.txt", "a\n", "first");

    repo.write("a.txt", b"changed\n");
    let diff = repo.git(&["diff"]).stdout;
    let out = TempDir::new("patch-apply");
    let patch = out.path().join("change.diff");
    std::fs::write(&patch, diff).expect("escribir parche");
    repo.git_ok(&["checkout", "--", "a.txt"]);

    apply_patch(&runner(), repo.path(), &patch, false, false).expect("git apply");

    let content = std::fs::read_to_string(repo.path().join("a.txt")).expect("leer a.txt");
    assert_eq!(content, "changed\n");
}
