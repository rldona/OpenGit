mod support;

use opengit_lib::git::{merge_branch, repo_op_abort, repo_op_state, Runner};
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

fn parents(repo: &TestRepo) -> Vec<String> {
    String::from_utf8(repo.git_ok(&["log", "-1", "--format=%P"]).stdout)
        .unwrap()
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

#[test]
fn fast_forward_merge_advances_branch_without_merge_commit() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "dos\n", "feature");
    let feature = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);

    let result = merge_branch(&runner(), repo.path(), "feature", false).expect("merge");

    assert!(!result.conflicted);
    assert_eq!(head(&repo), feature);
    assert_eq!(parents(&repo).len(), 1, "fast-forward: no merge commit");
}

#[test]
fn no_ff_merge_creates_merge_commit() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "dos\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);

    let result = merge_branch(&runner(), repo.path(), "feature", true).expect("merge no-ff");

    assert!(!result.conflicted);
    assert_eq!(parents(&repo).len(), 2, "no-ff: commit with two parents");
}

#[test]
fn conflicted_merge_leaves_operation_in_progress() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "cambio feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "cambio main");

    let result = merge_branch(&runner(), repo.path(), "feature", false).expect("merge");

    assert!(result.conflicted, "conflict must not be an error");
    assert!(
        result.output.to_lowercase().contains("conflict"),
        "{}",
        result.output
    );
    assert!(repo_op_state(&runner(), repo.path()).unwrap().merge);

    repo_op_abort(&runner(), repo.path()).expect("abort");
    assert!(!repo_op_state(&runner(), repo.path()).unwrap().merge);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "main\n",
        "abort leaves the tree as it was"
    );
}

#[test]
fn up_to_date_merge_is_not_an_error() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let result = merge_branch(&runner(), repo.path(), "main", false).expect("merge up to date");

    assert!(!result.conflicted);
    assert!(
        result.output.to_lowercase().contains("up to date")
            || result.output.to_lowercase().contains("actualizado"),
        "{}",
        result.output
    );
}

#[test]
fn failed_merge_without_conflict_is_an_error() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let error =
        merge_branch(&runner(), repo.path(), "no-existe", false).expect_err("missing branch");

    let text = format!("{error}").to_lowercase();
    assert!(
        text.contains("no-existe") || text.contains("not something we can merge"),
        "{text}"
    );
    assert!(!repo_op_state(&runner(), repo.path()).unwrap().merge);
}
