mod support;

use opengit_lib::git::{
    interactive_rebase, rebase_plan, repo_op_abort, repo_op_state, Runner, TodoAction, TodoItem,
};
use support::{TempDir, TestRepo};

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

fn subjects(repo: &TestRepo, base: &str) -> Vec<String> {
    String::from_utf8(
        repo.git_ok(&["log", "--reverse", "--format=%s", &format!("{base}..HEAD")])
            .stdout,
    )
    .unwrap()
    .lines()
    .map(str::to_string)
    .collect()
}

fn item(hash: &str, action: TodoAction) -> TodoItem {
    TodoItem {
        hash: hash.to_string(),
        action,
    }
}

fn setup() -> (TestRepo, TempDir, String, Vec<String>) {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    let base = head(&repo);
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head(&repo);
    commit_file(&repo, "b.txt", "dos\n", "c2");
    let c2 = head(&repo);
    commit_file(&repo, "a.txt", "tres\n", "c3");
    let c3 = head(&repo);
    (repo, TempDir::new("rebase-data"), base, vec![c1, c2, c3])
}

#[test]
fn el_plan_lista_los_commits_de_la_base_a_head_en_orden() {
    let (repo, _data, base, hashes) = setup();

    let plan = rebase_plan(&runner(), repo.path(), &base).expect("plan");

    assert_eq!(plan.len(), 3);
    assert_eq!(plan[0].hash, hashes[0]);
    assert_eq!(
        plan.iter().map(|c| c.subject.as_str()).collect::<Vec<_>>(),
        vec!["c1", "c2", "c3"]
    );
    assert_eq!(plan[0].short.len(), 12);
    assert!(rebase_plan(&runner(), repo.path(), &hashes[2])
        .unwrap()
        .is_empty());
}

#[test]
fn squash_y_fixup_unen_commits() {
    let (repo, data, base, hashes) = setup();

    interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[
            item(&hashes[0], TodoAction::Pick),
            item(&hashes[1], TodoAction::Squash),
            item(&hashes[2], TodoAction::Fixup),
        ],
        None,
    )
    .expect("rebase");

    // squash conserva el asunto del commit anterior (c1) y añade el mensaje de c2 al cuerpo;
    // el fixup de c3 descarta su mensaje.
    assert_eq!(subjects(&repo, &base), vec!["c1"]);
    let body = String::from_utf8(repo.git_ok(&["log", "-1", "--format=%B"]).stdout).unwrap();
    assert!(body.contains("c2"), "{body}");
    assert!(!body.contains("c3"), "{body}");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "tres\n"
    );
    assert_eq!(
        std::fs::read_to_string(repo.path().join("b.txt")).unwrap(),
        "dos\n"
    );
}

#[test]
fn drop_elimina_los_cambios_del_commit() {
    let (repo, data, base, hashes) = setup();

    interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[
            item(&hashes[0], TodoAction::Pick),
            item(&hashes[1], TodoAction::Drop),
            item(&hashes[2], TodoAction::Pick),
        ],
        None,
    )
    .expect("rebase");

    assert_eq!(subjects(&repo, &base), vec!["c1", "c3"]);
    assert!(!repo.path().join("b.txt").exists());
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "tres\n"
    );
}

#[test]
fn reword_cambia_el_mensaje_con_un_unico_texto() {
    let (repo, data, base, hashes) = setup();

    interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[
            item(&hashes[0], TodoAction::Pick),
            item(&hashes[1], TodoAction::Reword),
            item(&hashes[2], TodoAction::Pick),
        ],
        Some("mensaje nuevo"),
    )
    .expect("rebase");

    assert_eq!(subjects(&repo, &base), vec!["c1", "mensaje nuevo", "c3"]);
}

#[test]
fn reordenar_commits() {
    let (repo, data, base, hashes) = setup();

    interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[
            item(&hashes[1], TodoAction::Pick),
            item(&hashes[0], TodoAction::Pick),
            item(&hashes[2], TodoAction::Pick),
        ],
        None,
    )
    .expect("rebase");

    assert_eq!(subjects(&repo, &base), vec!["c2", "c1", "c3"]);
}

#[test]
fn reword_sin_mensaje_o_duplicado_falla() {
    let (repo, data, base, hashes) = setup();

    let error = interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[item(&hashes[0], TodoAction::Reword)],
        None,
    )
    .expect_err("sin mensaje");
    assert!(
        format!("{error}").contains("reword needs a message"),
        "{error}"
    );

    let error = interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[
            item(&hashes[0], TodoAction::Reword),
            item(&hashes[1], TodoAction::Reword),
        ],
        Some("mensaje"),
    )
    .expect_err("dos rewords");
    assert!(format!("{error}").contains("only one reword"), "{error}");
}

#[test]
fn un_conflicto_deja_el_rebase_en_curso_y_se_aborta() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "base\n", "base");
    let base = head(&repo);
    commit_file(&repo, "a.txt", "uno\n", "c1");
    let c1 = head(&repo);
    commit_file(&repo, "a.txt", "dos\n", "c2");
    let c2 = head(&repo);
    let data = TempDir::new("rebase-data");

    let error = interactive_rebase(
        &runner(),
        repo.path(),
        data.path(),
        &base,
        &[item(&c2, TodoAction::Pick), item(&c1, TodoAction::Pick)],
        None,
    )
    .expect_err("conflicto");
    assert!(
        format!("{error}").to_lowercase().contains("conflict"),
        "{error}"
    );

    let state = repo_op_state(&runner(), repo.path()).unwrap();
    assert_eq!(state.operation(), Some("rebase"));

    repo_op_abort(&runner(), repo.path()).expect("abort");
    assert!(repo_op_state(&runner(), repo.path()).unwrap().is_clean());
    assert_eq!(head(&repo), c2);
}
