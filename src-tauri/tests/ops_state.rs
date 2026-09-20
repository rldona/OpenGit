mod support;

use opengit_lib::git::{repo_op_abort, repo_op_continue, repo_op_skip, repo_op_state, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

fn head(repo: &TestRepo) -> String {
    String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string()
}

fn conflicted_merge(repo: &TestRepo) {
    commit_file(repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "otro"]);
    commit_file(repo, "a.txt", "otro\n", "cambio otro");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(repo, "a.txt", "main\n", "cambio main");
    let merge = repo.git(&["merge", "otro"]);
    assert!(!merge.status.success(), "the merge must remain in conflict");
}

#[test]
fn conflicted_merge_is_aborted() {
    let repo = TestRepo::init();
    conflicted_merge(&repo);
    let main_head = head(&repo);

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert_eq!(state.operation(), Some("merge"));

    repo_op_abort(&runner(), repo.path()).expect("abort");

    let clean = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(clean.is_clean());
    assert_eq!(head(&repo), main_head);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "main\n"
    );
}

#[test]
fn resolved_merge_is_continued() {
    let repo = TestRepo::init();
    conflicted_merge(&repo);

    repo.write("a.txt", b"resuelto\n");
    repo.git_ok(&["add", "a.txt"]);
    repo_op_continue(&runner(), repo.path()).expect("continue");

    let clean = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(clean.is_clean());
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "resuelto\n"
    );
    let parents = String::from_utf8(
        repo.git_ok(&["rev-list", "--parents", "-n", "1", "HEAD"])
            .stdout,
    )
    .unwrap();
    assert_eq!(
        parents.split_whitespace().count(),
        3,
        "merge commit with two parents"
    );
}

#[test]
fn conflicted_rebase_shows_progress_and_is_aborted() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    let feature_head = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    repo.git_ok(&["checkout", "-q", "feature"]);

    let rebase = repo.git(&["rebase", "main"]);
    assert!(
        !rebase.status.success(),
        "the rebase must remain in conflict"
    );

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert_eq!(state.operation(), Some("rebase"));
    assert_eq!(state.rebase_current, Some(1));
    assert_eq!(state.rebase_total, Some(1));

    repo_op_abort(&runner(), repo.path()).expect("abort");

    let clean = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(clean.is_clean());
    assert_eq!(head(&repo), feature_head);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "feature\n"
    );
}

#[test]
fn resolved_rebase_is_continued() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    let main_head = head(&repo);
    repo.git_ok(&["checkout", "-q", "feature"]);
    let rebase = repo.git(&["rebase", "main"]);
    assert!(!rebase.status.success());

    repo.write("a.txt", b"resuelto\n");
    repo.git_ok(&["add", "a.txt"]);
    repo_op_continue(&runner(), repo.path()).expect("continue");

    let clean = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(clean.is_clean());
    assert_eq!(
        repo.git_ok(&["rev-parse", "HEAD^"]).stdout,
        format!("{main_head}\n").into_bytes()
    );
    assert_eq!(
        repo.git_ok(&["log", "-1", "--format=%s"]).stdout,
        b"cambio feature\n"
    );
}

#[test]
fn conflicted_cherry_pick_is_aborted() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    let feature_head = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    let main_head = head(&repo);
    let pick = repo.git(&["cherry-pick", &feature_head]);
    assert!(!pick.status.success());

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert_eq!(state.operation(), Some("cherry-pick"));

    repo_op_abort(&runner(), repo.path()).expect("abort");

    assert!(repo_op_state(&runner(), repo.path()).unwrap().is_clean());
    assert_eq!(head(&repo), main_head);
}

#[test]
fn without_an_operation_abort_continue_and_skip_fail() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let abort = repo_op_abort(&runner(), repo.path()).expect_err("no operation");
    assert!(
        format!("{abort}").contains("no operation in progress"),
        "{abort}"
    );

    let cont = repo_op_continue(&runner(), repo.path()).expect_err("no operation");
    assert!(
        format!("{cont}").contains("no operation in progress"),
        "{cont}"
    );

    let skip = repo_op_skip(&runner(), repo.path()).expect_err("no operation");
    assert!(
        format!("{skip}").contains("no operation in progress"),
        "{skip}"
    );
}

#[test]
fn conflicted_cherry_pick_is_skipped() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    let feature_head = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    let main_head = head(&repo);
    let pick = repo.git(&["cherry-pick", &feature_head]);
    assert!(!pick.status.success());

    repo_op_skip(&runner(), repo.path()).expect("skip");

    assert!(repo_op_state(&runner(), repo.path()).unwrap().is_clean());
    assert_eq!(head(&repo), main_head, "the skipped commit is not applied");
    assert_eq!(
        repo.git_ok(&["log", "-1", "--format=%s"]).stdout,
        b"cambio main\n"
    );
}

#[test]
fn conflicted_rebase_is_skipped_and_finishes() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");
    let main_head = head(&repo);
    repo.git_ok(&["checkout", "-q", "feature"]);
    let rebase = repo.git(&["rebase", "main"]);
    assert!(!rebase.status.success());

    repo_op_skip(&runner(), repo.path()).expect("skip");

    assert!(repo_op_state(&runner(), repo.path()).unwrap().is_clean());
    assert_eq!(head(&repo), main_head, "the skipped patch is not applied");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "main\n"
    );
}

#[test]
fn conflicted_merge_cannot_be_skipped() {
    let repo = TestRepo::init();
    conflicted_merge(&repo);

    let error = repo_op_skip(&runner(), repo.path()).expect_err("merge without skip");
    assert!(format!("{error}").contains("merge has no skip"), "{error}");
    assert_eq!(
        repo_op_state(&runner(), repo.path()).unwrap().operation(),
        Some("merge"),
        "the merge is still in progress"
    );
}
