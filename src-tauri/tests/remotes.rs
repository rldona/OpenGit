mod support;

use opengit_lib::git::{
    remote_add, remote_remove, remote_rename, remote_set_url, remote_urls, Runner,
};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn names(repo: &TestRepo) -> Vec<String> {
    remote_urls(&runner(), repo.path())
        .expect("list remotes")
        .into_iter()
        .map(|remote| remote.name)
        .collect()
}

#[test]
fn add_lists_the_new_remote() {
    let repo = TestRepo::init();

    remote_add(
        &runner(),
        repo.path(),
        "origin",
        "https://example.com/repo.git",
    )
    .expect("add");

    let remotes = remote_urls(&runner(), repo.path()).expect("list");
    assert_eq!(remotes.len(), 1);
    assert_eq!(remotes[0].name, "origin");
    assert_eq!(remotes[0].url, "https://example.com/repo.git");
}

#[test]
fn set_url_changes_the_path() {
    let repo = TestRepo::init();
    let runner = runner();
    remote_add(&runner, repo.path(), "origin", "https://example.com/a.git").expect("add");

    remote_set_url(&runner, repo.path(), "origin", "git@example.com:b.git").expect("set-url");

    let remotes = remote_urls(&runner, repo.path()).expect("list");
    assert_eq!(remotes[0].url, "git@example.com:b.git");
}

#[test]
fn rename_moves_the_remote() {
    let repo = TestRepo::init();
    let runner = runner();
    remote_add(&runner, repo.path(), "origin", "https://example.com/a.git").expect("add");

    remote_rename(&runner, repo.path(), "origin", "upstream").expect("rename");

    assert_eq!(names(&repo), vec!["upstream".to_string()]);
}

#[test]
fn remove_drops_the_remote() {
    let repo = TestRepo::init();
    let runner = runner();
    remote_add(&runner, repo.path(), "origin", "https://example.com/a.git").expect("add");

    remote_remove(&runner, repo.path(), "origin").expect("remove");

    assert!(names(&repo).is_empty());
}

#[test]
fn invalid_names_and_empty_urls_are_rejected() {
    let repo = TestRepo::init();
    let runner = runner();

    assert!(remote_add(
        &runner,
        repo.path(),
        "bad name",
        "https://example.com/a.git"
    )
    .is_err());
    assert!(remote_add(&runner, repo.path(), "origin", "   ").is_err());
    assert!(remote_set_url(&runner, repo.path(), "origin", "").is_err());
    assert!(remote_rename(&runner, repo.path(), "origin", "bad/name").is_err());
}
