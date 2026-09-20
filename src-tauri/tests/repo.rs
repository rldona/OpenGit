mod support;

use opengit_lib::git::{self, error::GitError, Runner};
use opengit_lib::repo::{
    self, ops,
    recents::{RecentRepo, Recents},
};
use support::{git, TempDir, TestRepo};

fn runner() -> Runner {
    Runner::locate()
}

fn canonical(path: &std::path::Path) -> String {
    path.canonicalize()
        .expect("canonicalizar ruta")
        .to_string_lossy()
        .into_owned()
}

#[test]
fn opens_repo_with_history() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"a\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let info = repo::open(&runner(), repo.path()).expect("abrir repo");

    assert_eq!(info.root, canonical(repo.path()));
    assert_eq!(
        info.name,
        repo.path().file_name().unwrap().to_string_lossy()
    );
    assert!(info.has_commits);
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert!(!info.detached);
    assert!(info.head.is_some());
    assert!(!info.git_version.is_empty());
}

#[test]
fn reads_the_effective_git_identity() {
    let repo = TestRepo::init();

    let ident = git::author_ident(&runner(), repo.path()).expect("identidad");

    assert_eq!(ident.name, "OpenGit Test");
    assert_eq!(ident.email, "test@opengit.dev");
}

#[test]
fn from_subfolder_returns_the_root() {
    let repo = TestRepo::init();
    repo.write("a/b/c.txt", b"x\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let info = repo::open(&runner(), &repo.path().join("a")).expect("abrir subcarpeta");

    assert_eq!(info.root, canonical(repo.path()));
}

#[test]
fn opens_repo_without_commits() {
    let repo = TestRepo::init();

    let info = repo::open(&runner(), repo.path()).expect("abrir repo sin commits");

    assert!(!info.has_commits);
    assert!(info.head.is_none());
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert!(!info.detached);
}

#[test]
fn opens_repo_in_detached_head() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"a\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.git_ok(&["checkout", "-q", "--detach", "HEAD"]);

    let info = repo::open(&runner(), repo.path()).expect("abrir detached");

    assert!(info.detached);
    assert!(info.branch.is_none());
    assert!(info.head.is_some());
    assert!(info.has_commits);
}

#[test]
fn rejects_bare_repository() {
    let dir = TempDir::new("bare");
    let output = git(dir.path(), &["init", "--bare", "-q"]);
    assert!(output.status.success());

    let error = repo::open(&runner(), dir.path()).expect_err("bare no soportado");

    assert!(matches!(error, GitError::NotAWorkTree { .. }), "{error:?}");
}

#[test]
fn rejects_non_repo_folder_and_missing_path() {
    let dir = TempDir::new("plana");

    let error = repo::open(&runner(), dir.path()).expect_err("not a repo");
    assert!(
        matches!(error, GitError::NotARepository { .. }),
        "{error:?}"
    );

    let error = repo::open(&runner(), &dir.path().join("no-existe")).expect_err("does not exist");
    assert!(matches!(error, GitError::PathNotFound { .. }), "{error:?}");
}

#[test]
fn stage_unstage_and_discard_on_real_repo() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("a.txt", b"dos\n");
    ops::stage_paths(&runner(), repo.path(), &["a.txt"]).expect("stage");
    let staged = git::status(&runner(), repo.path()).expect("status staged");
    assert!(staged
        .entries
        .iter()
        .any(|entry| entry.path == "a.txt" && entry.xy == "M."));

    ops::unstage_paths(&runner(), repo.path(), &["a.txt"]).expect("unstage");
    let unstaged = git::status(&runner(), repo.path()).expect("status unstaged");
    assert!(unstaged
        .entries
        .iter()
        .any(|entry| entry.path == "a.txt" && entry.xy == ".M"));

    ops::discard_paths(&runner(), repo.path(), &["a.txt"]).expect("discard");
    let clean = git::status(&runner(), repo.path()).expect("status limpio");
    assert!(clean.entries.is_empty(), "{clean:?}");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "uno\n"
    );
}

#[test]
fn deletes_untracked_and_rejects_paths_outside_the_repo() {
    let repo = TestRepo::init();
    repo.write("suelto.txt", b"x\n");
    ops::remove_untracked(repo.path(), "suelto.txt").expect("borrar untracked");
    assert!(!repo.path().join("suelto.txt").exists());

    let error = ops::remove_untracked(repo.path(), "../fuera.txt").expect_err("ruta con ..");
    assert!(matches!(error, GitError::InvalidOutput { .. }));

    let error = ops::remove_untracked(repo.path(), "/etc/hosts").expect_err("ruta absoluta");
    assert!(matches!(error, GitError::InvalidOutput { .. }));
}

#[test]
fn recents_without_duplicates_and_persisted() {
    let dir = TempDir::new("recents");
    let file = dir.path().join("recent_repos.json");
    let store = Recents::new(&file);
    assert!(store.list().is_empty());

    let a = RecentRepo {
        path: "/repos/a".into(),
        name: "a".into(),
        opened_at: 1,
    };
    let b = RecentRepo {
        path: "/repos/b".into(),
        name: "b".into(),
        opened_at: 2,
    };
    store.add(&a).expect("añadir a");
    store.add(&b).expect("añadir b");
    store.add(&a).expect("re-añadir a");

    let list = Recents::new(&file).list();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].path, "/repos/a");
    assert_eq!(list[1].path, "/repos/b");

    store.remove("/repos/a").expect("quitar a");
    let list = Recents::new(&file).list();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].path, "/repos/b");
}

#[test]
fn remote_urls_lists_name_url_and_web() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"a\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.git_ok(&[
        "remote",
        "add",
        "origin",
        "git@github.com:rldona/opengit.git",
    ]);
    repo.git_ok(&["remote", "add", "local", "/tmp/otro-repo"]);

    let remotes = git::remote_urls(&runner(), repo.path()).expect("remotos");

    assert_eq!(remotes.len(), 2, "{remotes:?}");
    let origin = remotes
        .iter()
        .find(|remote| remote.name == "origin")
        .expect("origin");
    assert_eq!(origin.url, "git@github.com:rldona/opengit.git");
    assert_eq!(
        origin.web_url.as_deref(),
        Some("https://github.com/rldona/opengit")
    );

    let local = remotes
        .iter()
        .find(|remote| remote.name == "local")
        .expect("local");
    assert_eq!(local.web_url, None);
}

#[test]
fn gitignore_templates_are_available() {
    let templates = repo::gitignore_templates();

    assert!(templates.iter().any(|t| t.id == "rust" && t.name == "Rust"));
    assert!(templates.iter().any(|t| t.id == "node"));
}

#[test]
fn init_creates_repository_without_history() {
    let dir = TempDir::new("init-empty");
    let path = dir.path().join("project");

    repo::init(&runner(), &path, "trunk", None, false).expect("crear repo");

    let info = repo::open(&runner(), &path).expect("abrir repo creado");
    assert_eq!(info.branch.as_deref(), Some("trunk"));
    assert!(!info.has_commits);
    assert!(!path.join(".gitignore").exists());
}

#[test]
fn init_with_template_and_first_commit() {
    // `repo::init` commits with the process environment; give it an identity
    // without touching the user's global git config.
    std::env::set_var("GIT_AUTHOR_NAME", "OpenGit Test");
    std::env::set_var("GIT_AUTHOR_EMAIL", "test@opengit.dev");
    std::env::set_var("GIT_COMMITTER_NAME", "OpenGit Test");
    std::env::set_var("GIT_COMMITTER_EMAIL", "test@opengit.dev");

    let dir = TempDir::new("init-commit");
    let path = dir.path().join("project");

    repo::init(&runner(), &path, "main", Some("rust"), true).expect("crear repo");

    let info = repo::open(&runner(), &path).expect("abrir repo creado");
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert!(info.has_commits);
    assert!(path.join(".gitignore").exists());
}

#[test]
fn init_rejects_non_empty_destination() {
    let dir = TempDir::new("init-nonempty");
    std::fs::write(dir.path().join("file.txt"), b"x").expect("escribir fichero");

    let error = repo::init(&runner(), dir.path(), "main", None, false)
        .expect_err("un destino no vacío debe fallar");

    assert!(error.to_string().contains("not empty"));
}
