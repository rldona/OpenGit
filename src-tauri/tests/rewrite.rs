mod support;

use opengit_lib::git::{cherry_pick, repo_op_state, reset_mixed, revert_commit, status, Runner};
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

#[test]
fn cherry_pick_brings_the_commit_to_the_current_branch() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "feature.txt", "feature\n", "feature commit");
    let feature = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);

    cherry_pick(&runner(), repo.path(), &feature).expect("cherry-pick");

    assert!(repo.path().join("feature.txt").exists());
    assert_eq!(
        repo.git_ok(&["log", "-1", "--format=%s"]).stdout,
        b"feature commit\n"
    );
}

#[test]
fn cherry_pick_conflict_warns_and_leaves_state() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    let feature = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");

    let error = cherry_pick(&runner(), repo.path(), &feature).expect_err("conflicto");
    assert!(
        format!("{error}").to_lowercase().contains("conflict"),
        "{error}"
    );

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert!(state.cherry_pick, "must stay in cherry-pick state");

    repo.git_ok(&["cherry-pick", "--abort"]);
    assert!(!repo_op_state(&runner(), repo.path()).unwrap().cherry_pick);
}

#[test]
fn revert_creates_the_revert_commit() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    commit_file(&repo, "a.txt", "dos\n", "cambio");
    let change = head(&repo);

    revert_commit(&runner(), repo.path(), &change).expect("revert");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "uno\n"
    );
    let subject = String::from_utf8(repo.git_ok(&["log", "-1", "--format=%s"]).stdout).unwrap();
    assert!(subject.starts_with("Revert"), "{subject}");
}

#[test]
fn reset_mixed_moves_the_branch_and_keeps_files() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    let base = head(&repo);
    commit_file(&repo, "a.txt", "dos\n", "cambio");

    reset_mixed(&runner(), repo.path(), &base).expect("reset");

    assert_eq!(head(&repo), base);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "dos\n"
    );
    let report = status(&runner(), repo.path()).unwrap();
    assert!(report
        .entries
        .iter()
        .any(|entry| entry.path == "a.txt" && entry.xy == ".M"));
}

#[test]
fn invalid_hash_fails() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let error = cherry_pick(&runner(), repo.path(), "--help").expect_err("invalid hash");
    assert!(
        format!("{error}").contains("invalid commit hash"),
        "{error}"
    );
}
