mod support;

use std::path::Path;

use opengit_lib::git::{submodule_status, worktree_list, Runner, SubmoduleState};
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
fn worktrees_lista_rama_detached_locked_y_actual() {
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
fn submodule_estado_clean_modified_y_uninitialized() {
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
        "submodule add falló: {}",
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
