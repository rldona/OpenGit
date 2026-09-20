mod support;

use opengit_lib::git::{
    bisect_mark, bisect_reset, bisect_start, bisect_state, cherry_pick, cherry_pick_range, reflog,
    repo_op_state, reset, reset_mixed, revert_commit, status, BisectMark, ResetMode, Runner,
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

    revert_commit(&runner(), repo.path(), &change, None).expect("revert");

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

fn feature_with_two_commits(repo: &TestRepo) -> (String, String) {
    commit_file(repo, "base.txt", "base\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(repo, "f1.txt", "1\n", "f1");
    let first = head(repo);
    commit_file(repo, "f2.txt", "2\n", "f2");
    let second = head(repo);
    repo.git_ok(&["checkout", "-q", "main"]);
    (first, second)
}

#[test]
fn cherry_pick_range_applies_several_commits_in_order() {
    let repo = TestRepo::init();
    let (first, second) = feature_with_two_commits(&repo);

    let result = cherry_pick_range(&runner(), repo.path(), &[first, second], false)
        .expect("cherry-pick range");

    assert!(!result.conflicted, "{}", result.output);
    assert!(repo.path().join("f1.txt").exists());
    assert!(repo.path().join("f2.txt").exists());
}

#[test]
fn cherry_pick_range_accepts_a_revision_range() {
    let repo = TestRepo::init();
    let (_first, _second) = feature_with_two_commits(&repo);

    let result = cherry_pick_range(
        &runner(),
        repo.path(),
        &["main..feature".to_string()],
        false,
    )
    .expect("cherry-pick range");

    assert!(!result.conflicted, "{}", result.output);
    assert!(repo.path().join("f1.txt").exists());
    assert!(repo.path().join("f2.txt").exists());
}

#[test]
fn cherry_pick_range_records_the_source_with_x() {
    let repo = TestRepo::init();
    let (first, _second) = feature_with_two_commits(&repo);

    cherry_pick_range(&runner(), repo.path(), &[first], true).expect("cherry-pick -x");

    let body =
        String::from_utf8_lossy(&repo.git_ok(&["log", "-1", "--format=%b"]).stdout).to_string();
    assert!(body.contains("cherry picked from commit"), "{body}");
}

#[test]
fn reset_modes_soft_mixed_and_hard() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    commit_file(&repo, "a.txt", "dos\n", "second");
    let base = String::from_utf8_lossy(&repo.git_ok(&["rev-parse", "HEAD~1"]).stdout)
        .trim()
        .to_string();

    reset(&runner(), repo.path(), &base, ResetMode::Soft).expect("soft reset");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).expect("leer a.txt"),
        "dos\n"
    );
    assert_eq!(
        String::from_utf8_lossy(&repo.git_ok(&["status", "--porcelain"]).stdout),
        "M  a.txt\n"
    );

    reset(&runner(), repo.path(), &base, ResetMode::Mixed).expect("mixed reset");
    assert_eq!(
        String::from_utf8_lossy(&repo.git_ok(&["status", "--porcelain"]).stdout),
        " M a.txt\n"
    );

    reset(&runner(), repo.path(), &base, ResetMode::Hard).expect("hard reset");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).expect("leer a.txt"),
        "uno\n"
    );
    assert!(repo.git_ok(&["status", "--porcelain"]).stdout.is_empty());
}

#[test]
fn revert_merge_commit_needs_a_mainline() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "feature.txt", "f\n", "feature");
    repo.git_ok(&["checkout", "-q", "main"]);
    commit_file(&repo, "main.txt", "m\n", "main");
    repo.git_ok(&["merge", "-q", "--no-ff", "-m", "merge feature", "feature"]);
    let merge = head(&repo);

    // Without a mainline git refuses to revert a merge.
    assert!(revert_commit(&runner(), repo.path(), &merge, None).is_err());

    revert_commit(&runner(), repo.path(), &merge, Some(1)).expect("revert merge");

    // Mainline 1 is `main`, so the feature changes are undone.
    assert!(!repo.path().join("feature.txt").exists());
}

#[test]
fn reflog_lists_entries_newest_first() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    commit_file(&repo, "a.txt", "dos\n", "second");

    let entries = reflog(&runner(), repo.path(), 10).expect("reflog");

    assert!(entries.len() >= 2, "{entries:?}");
    // `%gs` prefixes the reflog action ("commit: second").
    assert!(
        entries[0].subject.ends_with("second"),
        "{}",
        entries[0].subject
    );
    assert!(
        entries[0].selector.starts_with("HEAD@{"),
        "{}",
        entries[0].selector
    );
    assert_eq!(entries[0].hash, head(&repo));
}

#[test]
fn bisect_start_mark_and_reset() {
    let repo = TestRepo::init();
    let mut hashes = Vec::new();
    for index in 0..8 {
        commit_file(&repo, "a.txt", &format!("{index}\n"), &format!("c{index}"));
        hashes.push(head(&repo));
    }
    let bad = hashes[7].clone();
    let good = hashes[0].clone();

    bisect_start(&runner(), repo.path(), Some(&bad), &[good]).expect("bisect start");
    let state = bisect_state(&runner(), repo.path()).expect("state");
    assert!(state.active);
    assert!(state.current.is_some());
    assert!(state.remaining.unwrap_or(0) > 0, "{state:?}");

    bisect_mark(&runner(), repo.path(), BisectMark::Good).expect("mark good");
    assert!(bisect_state(&runner(), repo.path()).unwrap().active);

    bisect_reset(&runner(), repo.path()).expect("bisect reset");
    assert!(!bisect_state(&runner(), repo.path()).unwrap().active);
}
