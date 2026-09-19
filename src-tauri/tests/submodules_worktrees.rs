mod support;

use std::path::Path;

use opengit_lib::git::{
    submodule_add, submodule_status, submodule_sync, submodule_update, worktree_add, worktree_list,
    worktree_remove, Runner, SubmoduleState,
};
use support::{git, TempDir, TestRepo};

fn runner() -> Runner {
    Runner::locate()
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

fn head_hash(repo: &TestRepo) -> String {
    String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string()
}

fn same_path(left: &str, right: &Path) -> bool {
    std::fs::canonicalize(left).ok() == std::fs::canonicalize(right).ok()
}

#[test]
fn worktrees_list_branch_detached_locked_and_current() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    let base = head_hash(&repo);
    repo.git_ok(&["branch", "topic"]);

    let dir = TempDir::new("worktrees");
    let topic_path = dir.path().join("topic");
    let detached_path = dir.path().join("detached");
    let locked_path = dir.path().join("locked");
    repo.git_ok(&[
        "worktree",
        "add",
        "-q",
        topic_path.to_str().unwrap(),
        "topic",
    ]);
    repo.git_ok(&[
        "worktree",
        "add",
        "-q",
        "--detach",
        detached_path.to_str().unwrap(),
        &base,
    ]);
    repo.git_ok(&[
        "worktree",
        "add",
        "-q",
        locked_path.to_str().unwrap(),
        "-b",
        "locked",
    ]);
    repo.git_ok(&["worktree", "lock", locked_path.to_str().unwrap()]);

    let worktrees = worktree_list(&runner(), repo.path()).expect("listar worktrees");
    assert_eq!(worktrees.len(), 4, "{worktrees:?}");

    let main = worktrees
        .iter()
        .find(|entry| same_path(&entry.path, repo.path()))
        .expect("worktree principal");
    assert_eq!(main.branch.as_deref(), Some("refs/heads/main"));
    assert_eq!(main.head, base);
    assert!(!main.detached && !main.bare && !main.locked);

    let topic = worktrees
        .iter()
        .find(|entry| same_path(&entry.path, &topic_path))
        .expect("worktree de rama");
    assert_eq!(topic.branch.as_deref(), Some("refs/heads/topic"));
    assert!(!topic.detached);

    let detached = worktrees
        .iter()
        .find(|entry| same_path(&entry.path, &detached_path))
        .expect("worktree detached");
    assert!(detached.detached);
    assert_eq!(detached.branch, None);
    assert_eq!(detached.head, base);

    let locked = worktrees
        .iter()
        .find(|entry| same_path(&entry.path, &locked_path))
        .expect("worktree bloqueado");
    assert!(locked.locked);
    assert_eq!(locked.branch.as_deref(), Some("refs/heads/locked"));
}

#[test]
fn submodule_state_clean_modified_and_uninitialized() {
    let source = TestRepo::init();
    commit_file(&source, "lib.txt", "lib\n", "sub base");

    let super_repo = TestRepo::init();
    commit_file(&super_repo, "x.txt", "x\n", "base");

    let path_with_spaces = "vendor/lib con espacio";
    let added = git(
        super_repo.path(),
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            "-q",
            source.path().to_str().unwrap(),
            path_with_spaces,
        ],
    );
    assert!(
        added.status.success(),
        "submodule add failed: {}",
        String::from_utf8_lossy(&added.stderr)
    );
    super_repo.git_ok(&["commit", "-q", "-m", "add sub"]);

    let submodules = submodule_status(&runner(), super_repo.path()).expect("status");
    assert_eq!(submodules.len(), 1, "{submodules:?}");
    let sub = &submodules[0];
    assert_eq!(sub.path, path_with_spaces);
    assert_eq!(sub.state, SubmoduleState::Clean);
    assert_eq!(sub.describe.as_deref(), Some("heads/main"));
    let recorded = sub.head.clone();

    let submodule_path = super_repo.path().join(path_with_spaces);
    std::fs::write(submodule_path.join("lib.txt"), b"lib\nmore\n").expect("escribir en el sub");
    let staged = git(&submodule_path, &["add", "."]);
    assert!(staged.status.success(), "{staged:?}");
    let committed = git(&submodule_path, &["commit", "-q", "-m", "sub avance"]);
    assert!(committed.status.success(), "{committed:?}");

    let submodules = submodule_status(&runner(), super_repo.path()).expect("status avanzado");
    assert_eq!(submodules[0].state, SubmoduleState::Modified);
    assert_ne!(submodules[0].head, recorded);

    let deinit = git(
        super_repo.path(),
        &["submodule", "deinit", "-f", "-q", path_with_spaces],
    );
    assert!(deinit.status.success(), "{deinit:?}");

    let submodules = submodule_status(&runner(), super_repo.path()).expect("status sin init");
    assert_eq!(submodules[0].state, SubmoduleState::Uninitialized);
    assert_eq!(submodules[0].head, recorded);
    assert_eq!(submodules[0].describe, None);
}

#[test]
fn adds_and_removes_worktrees() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let dir = TempDir::new("worktree-manage");
    let new_path = dir.path().join("nueva");
    let reused_path = dir.path().join("reusada");

    worktree_add(
        &runner(),
        repo.path(),
        new_path.to_str().unwrap(),
        "feature",
        true,
        Some("HEAD"),
    )
    .expect("worktree add con rama nueva");

    let worktrees = worktree_list(&runner(), repo.path()).expect("listar");
    assert!(
        worktrees
            .iter()
            .any(|entry| same_path(&entry.path, &new_path)
                && entry.branch.as_deref() == Some("refs/heads/feature")),
        "{worktrees:?}"
    );

    let error = worktree_add(
        &runner(),
        repo.path(),
        reused_path.to_str().unwrap(),
        "feature",
        false,
        None,
    )
    .expect_err("la rama ya está en uso");
    assert!(
        format!("{error}").to_lowercase().contains("already"),
        "{error}"
    );

    let error = worktree_remove(&runner(), repo.path(), repo.path().to_str().unwrap(), false)
        .expect_err("no se puede borrar el principal");
    assert!(
        format!("{error}")
            .to_lowercase()
            .contains("main working tree"),
        "{error}"
    );

    worktree_remove(&runner(), repo.path(), new_path.to_str().unwrap(), false).expect("remove");

    let worktrees = worktree_list(&runner(), repo.path()).expect("listar tras borrar");
    assert!(!worktrees
        .iter()
        .any(|entry| same_path(&entry.path, &new_path)));
}

#[test]
fn manages_submodules_add_init_and_sync() {
    // Local submodule clones require the file protocol. The app command does
    // not force it (security), so the test process enables it through git's
    // config environment, which the child clone inherits.
    //
    // The trio must never be observable partially: tests share one process
    // and run on parallel threads, and a `git` spawn landing between
    // `COUNT` and `VALUE_0` fails with "missing config value
    // GIT_CONFIG_VALUE_0" (CI flake, OG-073). Without `COUNT`, git ignores
    // the key and value, so `COUNT` goes last here and first on teardown.
    std::env::set_var("GIT_CONFIG_KEY_0", "protocol.file.allow");
    std::env::set_var("GIT_CONFIG_VALUE_0", "always");
    std::env::set_var("GIT_CONFIG_COUNT", "1");

    let source = TestRepo::init();
    commit_file(&source, "lib.txt", "lib\n", "sub base");

    let super_repo = TestRepo::init();
    commit_file(&super_repo, "x.txt", "x\n", "base");

    submodule_add(
        &runner(),
        super_repo.path(),
        source.path().to_str().unwrap(),
        "vendor/lib",
    )
    .expect("submodule add");

    let submodules = submodule_status(&runner(), super_repo.path()).expect("status");
    assert_eq!(submodules.len(), 1, "{submodules:?}");
    assert_eq!(submodules[0].path, "vendor/lib");
    assert_eq!(submodules[0].state, SubmoduleState::Clean);

    let deinit = git(
        super_repo.path(),
        &["submodule", "deinit", "-f", "-q", "vendor/lib"],
    );
    assert!(deinit.status.success(), "{deinit:?}");
    assert_eq!(
        submodule_status(&runner(), super_repo.path()).expect("status")[0].state,
        SubmoduleState::Uninitialized
    );

    submodule_update(&runner(), super_repo.path(), true, true).expect("submodule update --init");
    assert_eq!(
        submodule_status(&runner(), super_repo.path()).expect("status")[0].state,
        SubmoduleState::Clean
    );

    submodule_sync(&runner(), super_repo.path()).expect("submodule sync");

    // Teardown in reverse order (see above): dropping `COUNT` first returns
    // every concurrent `git` spawn to the ignore-the-rest state.
    std::env::remove_var("GIT_CONFIG_COUNT");
    std::env::remove_var("GIT_CONFIG_KEY_0");
    std::env::remove_var("GIT_CONFIG_VALUE_0");
}

#[test]
fn adding_a_submodule_validates_url_and_path() {
    let repo = TestRepo::init();
    commit_file(&repo, "x.txt", "x\n", "base");

    assert!(submodule_add(&runner(), repo.path(), "", "vendor/lib").is_err());
    assert!(submodule_add(&runner(), repo.path(), "https://example.com/x.git", "").is_err());
}

#[test]
fn removes_a_worktree_only_with_force_when_dirty() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let dir = TempDir::new("worktree-force");
    let path = dir.path().join("sucia");
    worktree_add(
        &runner(),
        repo.path(),
        path.to_str().unwrap(),
        "sucia",
        true,
        Some("HEAD"),
    )
    .expect("worktree add");
    std::fs::write(path.join("a.txt"), b"cambio\n").expect("escribir");

    let error = worktree_remove(&runner(), repo.path(), path.to_str().unwrap(), false)
        .expect_err("necesita force");
    assert!(
        format!("{error}").to_lowercase().contains("--force"),
        "{error}"
    );

    worktree_remove(&runner(), repo.path(), path.to_str().unwrap(), true).expect("force");
}
