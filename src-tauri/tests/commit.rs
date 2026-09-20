mod support;

use opengit_lib::git::{commit, last_commit_message, repo_op_state, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn commit_with_multiline_utf8_message_and_quotes() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);

    let message = "feat: añade «cosas»\n\nSegunda línea con emoji 🎉 y comillas \"dobles\".";
    let result = commit(&runner(), repo.path(), message, false).expect("commit");

    assert_eq!(result.subject, "feat: añade «cosas»");
    assert!(!result.hash.is_empty());
    let stored = repo.git_ok(&["log", "-1", "--format=%B"]).stdout;
    assert_eq!(String::from_utf8(stored).unwrap().trim_end(), message);
}

#[test]
fn commit_without_staged_changes_fails_with_message() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("a.txt", b"dos\n");

    let error =
        commit(&runner(), repo.path(), "no debería crearse", false).expect_err("nothing staged");

    let text = format!("{error}");
    assert!(
        text.contains("nothing to commit") || text.contains("no changes added"),
        "{text}"
    );
    assert_eq!(repo.git_ok(&["rev-list", "--count", "HEAD"]).stdout, b"1\n");
}

#[test]
fn amend_updates_message_and_content() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    commit(&runner(), repo.path(), "primero", false).expect("initial commit");

    repo.write("a.txt", b"uno\nmas\n");
    repo.git_ok(&["add", "a.txt"]);
    commit(&runner(), repo.path(), "primero corregido", true).expect("amend");

    assert_eq!(repo.git_ok(&["rev-list", "--count", "HEAD"]).stdout, b"1\n");
    assert_eq!(
        last_commit_message(&runner(), repo.path()).unwrap(),
        "primero corregido"
    );
    assert_eq!(repo.git_ok(&["show", "HEAD:a.txt"]).stdout, b"uno\nmas\n");
}

#[cfg(unix)]
#[test]
fn failing_hook_leaves_its_output_visible() {
    use std::os::unix::fs::PermissionsExt;

    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let hook = repo.path().join(".git/hooks/pre-commit");
    std::fs::write(&hook, b"#!/bin/sh\necho 'hook dice no' >&2\nexit 1\n").unwrap();
    std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();

    repo.write("a.txt", b"dos\n");
    repo.git_ok(&["add", "."]);
    let error = commit(&runner(), repo.path(), "con hook roto", false).expect_err("hook fails");
    let text = format!("{error}");
    assert!(text.contains("hook dice no"), "{text}");
    assert_eq!(repo.git_ok(&["rev-list", "--count", "HEAD"]).stdout, b"1\n");
}

#[test]
fn detects_merge_in_progress() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"base\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.git_ok(&["checkout", "-q", "-b", "otra"]);
    repo.write("a.txt", b"otra\n");
    repo.git_ok(&["commit", "-q", "-am", "cambio otra"]);
    repo.git_ok(&["checkout", "-q", "main"]);
    repo.write("a.txt", b"main\n");
    repo.git_ok(&["commit", "-q", "-am", "cambio main"]);

    let clean = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(!clean.merge && !clean.rebase && !clean.cherry_pick);

    let merge = repo.git(&["merge", "otra"]);
    assert!(!merge.status.success(), "the merge must remain in conflict");

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(state.merge, "must detect MERGE_HEAD");
    assert!(!state.rebase);
}
