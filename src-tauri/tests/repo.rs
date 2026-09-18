mod support;

use opengit_lib::git::{error::GitError, Runner};
use opengit_lib::repo::{
    self,
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
fn abre_repo_con_historial() {
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
fn desde_subcarpeta_devuelve_la_raiz() {
    let repo = TestRepo::init();
    repo.write("a/b/c.txt", b"x\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let info = repo::open(&runner(), &repo.path().join("a")).expect("abrir subcarpeta");

    assert_eq!(info.root, canonical(repo.path()));
}

#[test]
fn abre_repo_sin_commits() {
    let repo = TestRepo::init();

    let info = repo::open(&runner(), repo.path()).expect("abrir repo sin commits");

    assert!(!info.has_commits);
    assert!(info.head.is_none());
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert!(!info.detached);
}

#[test]
fn abre_repo_en_detached_head() {
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
fn rechaza_repositorio_bare() {
    let dir = TempDir::new("bare");
    let output = git(dir.path(), &["init", "--bare", "-q"]);
    assert!(output.status.success());

    let error = repo::open(&runner(), dir.path()).expect_err("bare no soportado");

    assert!(matches!(error, GitError::NotAWorkTree { .. }), "{error:?}");
}

#[test]
fn rechaza_carpeta_que_no_es_repo_y_ruta_inexistente() {
    let dir = TempDir::new("plana");

    let error = repo::open(&runner(), dir.path()).expect_err("no es repo");
    assert!(
        matches!(error, GitError::NotARepository { .. }),
        "{error:?}"
    );

    let error = repo::open(&runner(), &dir.path().join("no-existe")).expect_err("no existe");
    assert!(matches!(error, GitError::PathNotFound { .. }), "{error:?}");
}

#[test]
fn recientes_sin_duplicados_y_persistidos() {
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
