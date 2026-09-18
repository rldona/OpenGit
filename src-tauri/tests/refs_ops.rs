mod support;

use opengit_lib::git::{
    branch_tracking, checkout_ref, create_branch, delete_branch, rename_branch, Runner,
};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn head_hash(repo: &TestRepo) -> String {
    String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string()
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

#[test]
fn tracking_sin_upstream_y_con_ahead() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head_hash(&repo);
    commit_file(&repo, "a.txt", "dos\n", "c2");

    let plain = branch_tracking(&runner(), repo.path()).unwrap();
    assert_eq!(plain.current.as_deref(), Some("main"));
    assert!(plain.upstream.is_none());
    assert_eq!((plain.ahead, plain.behind), (0, 0));

    repo.git_ok(&["remote", "add", "origin", "/ruta/inexistente"]);
    repo.git_ok(&["update-ref", "refs/remotes/origin/main", &c1]);
    repo.git_ok(&["branch", "--set-upstream-to=origin/main", "main"]);

    let tracking = branch_tracking(&runner(), repo.path()).unwrap();
    assert_eq!(tracking.upstream.as_deref(), Some("origin/main"));
    assert_eq!((tracking.ahead, tracking.behind), (1, 0));
}

#[test]
fn tracking_con_behind() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head_hash(&repo);
    commit_file(&repo, "a.txt", "dos\n", "c2");
    let c2 = head_hash(&repo);

    repo.git_ok(&["remote", "add", "origin", "/ruta/inexistente"]);
    repo.git_ok(&["update-ref", "refs/remotes/origin/main", &c2]);
    repo.git_ok(&["checkout", "-q", "-b", "old", &c1]);
    repo.git_ok(&["branch", "--set-upstream-to=origin/main", "old"]);

    let tracking = branch_tracking(&runner(), repo.path()).unwrap();
    assert_eq!(tracking.current.as_deref(), Some("old"));
    assert_eq!((tracking.ahead, tracking.behind), (0, 1));
}

#[test]
fn checkout_local_y_remoto_con_tracking() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head_hash(&repo);
    repo.git_ok(&["branch", "feature", &c1]);

    checkout_ref(&runner(), repo.path(), "feature", false).expect("checkout local");
    assert_eq!(
        repo.git_ok(&["symbolic-ref", "--short", "HEAD"]).stdout,
        b"feature\n"
    );

    repo.git_ok(&["checkout", "-q", "main"]);
    repo.git_ok(&["remote", "add", "origin", "/ruta/inexistente"]);
    repo.git_ok(&["update-ref", "refs/remotes/origin/remota", &c1]);
    checkout_ref(&runner(), repo.path(), "origin/remota", true).expect("checkout remoto");

    assert_eq!(
        repo.git_ok(&["symbolic-ref", "--short", "HEAD"]).stdout,
        b"remota\n"
    );
    assert_eq!(
        repo.git_ok(&[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}"
        ])
        .stdout,
        b"origin/remota\n"
    );
}

#[test]
fn crear_renombrar_y_borrar_ramas() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head_hash(&repo);

    create_branch(&runner(), repo.path(), "nueva", &c1).expect("crear");
    assert!(repo
        .git_ok(&["show-ref", "--verify", "refs/heads/nueva"])
        .status
        .success());

    rename_branch(&runner(), repo.path(), "nueva", "renombrada").expect("renombrar");
    assert!(repo
        .git_ok(&["show-ref", "--verify", "refs/heads/renombrada"])
        .status
        .success());

    delete_branch(&runner(), repo.path(), "renombrada", false).expect("borrar mergeada");
    assert!(!repo
        .git(&["show-ref", "--verify", "refs/heads/renombrada"])
        .status
        .success());
}

#[test]
fn borrar_rama_sin_mergear_requiere_force() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    repo.git_ok(&["checkout", "-q", "-b", "suelta"]);
    commit_file(&repo, "b.txt", "suelto\n", "c2");
    repo.git_ok(&["checkout", "-q", "main"]);

    let error = delete_branch(&runner(), repo.path(), "suelta", false).expect_err("no mergeada");
    assert!(format!("{error}").contains("not fully merged"), "{error}");

    delete_branch(&runner(), repo.path(), "suelta", true).expect("force");
    assert!(!repo
        .git(&["show-ref", "--verify", "refs/heads/suelta"])
        .status
        .success());
}

#[test]
fn nombres_de_rama_invalidos_fallan() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head_hash(&repo);

    let error = create_branch(&runner(), repo.path(), "mala..rama", &c1).expect_err("inválida");
    assert!(
        format!("{error}").contains("invalid branch name"),
        "{error}"
    );
}
