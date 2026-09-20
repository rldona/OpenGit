mod support;

use opengit_lib::git::{
    merge_branch, repo_op_abort, repo_op_state, MergeOptions, MergeStrategy, Runner,
};
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

    let result =
        merge_branch(&runner(), repo.path(), "feature", MergeOptions::default()).expect("merge");

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

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            no_ff: true,
            ..MergeOptions::default()
        },
    )
    .expect("merge no-ff");

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

    let result =
        merge_branch(&runner(), repo.path(), "feature", MergeOptions::default()).expect("merge");

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

    let result = merge_branch(&runner(), repo.path(), "main", MergeOptions::default())
        .expect("merge up to date");

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

    let error = merge_branch(&runner(), repo.path(), "no-existe", MergeOptions::default())
        .expect_err("missing branch");

    let text = format!("{error}").to_lowercase();
    assert!(
        text.contains("no-existe") || text.contains("not something we can merge"),
        "{text}"
    );
    assert!(!repo_op_state(&runner(), repo.path()).unwrap().merge);
}

#[test]
fn merge_no_commit_stages_the_result_without_committing() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "dos\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "c.txt", "tres\n", "main moves");

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            no_commit: true,
            ..MergeOptions::default()
        },
    )
    .expect("merge --no-commit");

    assert!(!result.conflicted);
    assert_eq!(parents(&repo).len(), 1, "no merge commit yet");
    assert!(repo_op_state(&runner(), repo.path()).unwrap().merge);
    let staged =
        String::from_utf8(repo.git_ok(&["diff", "--cached", "--name-only"]).stdout).unwrap();
    assert!(staged.contains("b.txt"), "{staged}");
}

#[test]
fn merge_rebase_replays_the_current_branch() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "dos\n", "feature");
    let feature = head(&repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "c.txt", "tres\n", "main moves");

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            rebase: true,
            ..MergeOptions::default()
        },
    )
    .expect("merge --rebase");

    assert!(!result.conflicted);
    assert_eq!(parents(&repo).len(), 1, "rebase: no merge commit");
    assert_eq!(parents(&repo)[0], feature);
    let subjects = String::from_utf8(repo.git_ok(&["log", "--format=%s", "-2"]).stdout).unwrap();
    assert!(subjects.contains("main moves"), "{subjects}");
}

#[test]
fn squash_merge_stages_changes_without_committing() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "dos\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "c.txt", "tres\n", "main moves");

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            squash: true,
            ..MergeOptions::default()
        },
    )
    .expect("merge --squash");

    assert!(!result.conflicted);
    assert_eq!(parents(&repo).len(), 1, "squash: no merge commit");
    assert!(
        !repo_op_state(&runner(), repo.path()).unwrap().merge,
        "--squash does not write MERGE_HEAD"
    );
    let staged =
        String::from_utf8(repo.git_ok(&["diff", "--cached", "--name-only"]).stdout).unwrap();
    assert!(staged.contains("b.txt"), "{staged}");
}

#[test]
fn ours_strategy_resolves_content_conflicts() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "main");

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            strategy: Some(MergeStrategy::Ours),
            ..MergeOptions::default()
        },
    )
    .expect("merge -X ours");

    assert!(!result.conflicted);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "main\n"
    );
    assert_eq!(
        parents(&repo).len(),
        2,
        "ours still creates the merge commit"
    );
}

#[test]
fn theirs_strategy_resolves_content_conflicts() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "a.txt", "feature\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "a.txt", "main\n", "main");

    let result = merge_branch(
        &runner(),
        repo.path(),
        "feature",
        MergeOptions {
            strategy: Some(MergeStrategy::Theirs),
            ..MergeOptions::default()
        },
    )
    .expect("merge -X theirs");

    assert!(!result.conflicted);
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "feature\n"
    );
    assert_eq!(
        parents(&repo).len(),
        2,
        "theirs still creates the merge commit"
    );
}
