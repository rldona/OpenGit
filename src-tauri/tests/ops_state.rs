mod support;

use opengit_lib::git::{repo_op_abort, repo_op_continue, repo_op_state, Runner};
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
    assert!(!merge.status.success(), "el merge debe quedar en conflicto");
}

#[test]
fn merge_en_conflicto_se_aborta() {
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
fn merge_resuelto_se_continua() {
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
        "merge commit con dos padres"
    );
}

#[test]
fn rebase_en_conflicto_muestra_progreso_y_se_aborta() {
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
        "el rebase debe quedar en conflicto"
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
fn rebase_resuelto_se_continua() {
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
fn cherry_pick_en_conflicto_se_aborta() {
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
fn sin_operacion_abort_y_continue_fallan() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let abort = repo_op_abort(&runner(), repo.path()).expect_err("sin operación");
    assert!(
        format!("{abort}").contains("no operation in progress"),
        "{abort}"
    );

    let cont = repo_op_continue(&runner(), repo.path()).expect_err("sin operación");
    assert!(
        format!("{cont}").contains("no operation in progress"),
        "{cont}"
    );
}
