mod support;

use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use opengit_lib::git::{
    stash_apply, stash_drop, stash_list, stash_push, stash_show, status, tag_create, tag_delete,
    Runner,
};
use opengit_lib::jobs::{start, JobKind, JobManager, RemoteJobEvent};
use support::{git, TempDir, TestRepo};

fn runner() -> Runner {
    Runner::locate()
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

#[test]
fn stash_create_list_apply_and_drop() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    repo.write("a.txt", b"cambiado\n");
    repo.write("nuevo.txt", b"sin trackear\n");
    stash_push(&runner(), repo.path(), Some("mi stash"), true).expect("stash");

    let clean = status(&runner(), repo.path()).unwrap();
    assert!(clean.entries.is_empty(), "{clean:?}");

    let stashes = stash_list(&runner(), repo.path()).unwrap();
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].subject.contains("mi stash"), "{:?}", stashes[0]);
    assert_eq!(stashes[0].reference, "stash@{0}");

    stash_apply(&runner(), repo.path(), "stash@{0}", false).expect("apply");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "cambiado\n"
    );
    assert!(repo.path().join("nuevo.txt").exists());
    assert_eq!(stash_list(&runner(), repo.path()).unwrap().len(), 1);

    stash_drop(&runner(), repo.path(), "stash@{0}").expect("drop");
    assert!(stash_list(&runner(), repo.path()).unwrap().is_empty());
}

#[test]
fn stash_pop_applies_and_drops() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.write("a.txt", b"dos\n");
    stash_push(&runner(), repo.path(), None, false).expect("stash");

    stash_apply(&runner(), repo.path(), "stash@{0}", true).expect("pop");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "dos\n"
    );
    assert!(stash_list(&runner(), repo.path()).unwrap().is_empty());
}

#[test]
fn a_conflict_keeps_the_stash() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    repo.write("a.txt", b"stash\n");
    stash_push(&runner(), repo.path(), Some("conflicto"), false).expect("stash");

    repo.write("a.txt", b"local\n");
    repo.git_ok(&["commit", "-q", "-am", "cambio local"]);
    let error = stash_apply(&runner(), repo.path(), "stash@{0}", true).expect_err("conflicto");
    assert!(format!("{error}").contains("conflict"), "{error}");

    assert_eq!(stash_list(&runner(), repo.path()).unwrap().len(), 1);
}

#[test]
fn invalid_stash_references_fail() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let error = stash_drop(&runner(), repo.path(), "HEAD~1").expect_err("referencia inválida");
    assert!(
        format!("{error}").contains("invalid stash reference"),
        "{error}"
    );
}

#[test]
fn lightweight_annotated_tags_and_deletion() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    let head = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    tag_create(&runner(), repo.path(), "v1.0.0", &head, None).expect("lightweight tag");
    tag_create(&runner(), repo.path(), "v1.1.0", &head, Some("con mensaje"))
        .expect("annotated tag");

    assert_eq!(
        repo.git_ok(&["cat-file", "-t", "refs/tags/v1.0.0"]).stdout,
        b"commit\n"
    );
    assert_eq!(
        repo.git_ok(&["cat-file", "-t", "refs/tags/v1.1.0"]).stdout,
        b"tag\n"
    );
    assert!(
        String::from_utf8(repo.git_ok(&["tag", "-n", "-l", "v1.1.0"]).stdout)
            .unwrap()
            .contains("con mensaje")
    );

    tag_delete(&runner(), repo.path(), "v1.0.0").expect("borrar");
    assert!(!repo
        .git(&["rev-parse", "--verify", "refs/tags/v1.0.0"])
        .status
        .success());

    let error = tag_create(&runner(), repo.path(), "mala..tag", &head, None).expect_err("invalid");
    assert!(format!("{error}").contains("invalid ref name"), "{error}");
}

#[test]
fn push_a_tag_to_the_remote() {
    let remote = TempDir::new("bare-tag");
    let init = git(remote.path(), &["init", "--bare", "-b", "main", "-q"]);
    assert!(init.status.success());

    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");
    let head = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();
    tag_create(&runner(), repo.path(), "v2.0.0", &head, Some("release")).expect("tag");
    repo.git_ok(&["remote", "add", "origin", remote.path().to_str().unwrap()]);

    let manager = JobManager::new();
    let id = manager.next_id();
    let (sender, receiver) = mpsc::channel::<RemoteJobEvent>();
    let sender = Arc::new(Mutex::new(sender));
    start(
        &manager,
        &id,
        &runner(),
        repo.path(),
        &JobKind::PushTag {
            remote: Some("origin".into()),
            tag: "v2.0.0".into(),
        },
        move |event| {
            let _ = sender.lock().unwrap().send(event);
        },
    )
    .expect("arrancar job");

    let deadline = Instant::now() + Duration::from_secs(20);
    let mut finished = None;
    while Instant::now() < deadline {
        if let Ok(RemoteJobEvent::Finished { success, .. }) =
            receiver.recv_timeout(Duration::from_millis(200))
        {
            finished = Some(success);
            break;
        }
    }
    assert_eq!(finished, Some(true), "the tag push must succeed");
    assert_eq!(
        git(remote.path(), &["cat-file", "-t", "refs/tags/v2.0.0"]).stdout,
        b"tag\n"
    );
}

#[test]
fn stash_show_includes_tracked_and_untracked() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    repo.write("a.txt", b"dos\n");
    repo.write("nuevo.txt", b"sin trackear\n");
    stash_push(&runner(), repo.path(), Some("mi stash"), true).expect("stash");

    let patch = stash_show(&runner(), repo.path(), "stash@{0}").expect("show");
    assert!(patch.contains("a.txt"), "{patch}");
    assert!(patch.contains("+dos"), "{patch}");
    assert!(patch.contains("nuevo.txt"), "{patch}");
    assert!(patch.contains("+sin trackear"), "{patch}");
}

#[test]
fn stash_show_validates_the_reference() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "base");

    let error = stash_show(&runner(), repo.path(), "HEAD").expect_err("referencia inválida");
    assert!(
        format!("{error}").contains("invalid stash reference"),
        "{error}"
    );
}
