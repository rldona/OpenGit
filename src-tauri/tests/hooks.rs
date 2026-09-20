mod support;

use opengit_lib::git::{hook_read, hook_set_enabled, hook_write, hooks_list, GitError, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn write_sample(repo: &TestRepo, name: &str) {
    repo.write(
        &format!(".git/hooks/{name}.sample"),
        b"#!/bin/sh\necho sample\n",
    );
}

#[test]
fn hooks_list_reports_samples_and_installed_hooks() {
    let repo = TestRepo::init();
    write_sample(&repo, "pre-commit");

    let hooks = hooks_list(&runner(), repo.path()).expect("hooks_list");
    let hook = hooks
        .iter()
        .find(|hook| hook.name == "pre-commit")
        .expect("pre-commit");

    assert!(hook.sample);
    assert!(!hook.installed);
    assert!(!hook.active);
    assert!(!hook.disabled);
}

#[test]
fn enabling_creates_the_hook_from_the_sample() {
    let repo = TestRepo::init();
    write_sample(&repo, "pre-commit");

    hook_set_enabled(&runner(), repo.path(), "pre-commit", true).expect("enable");

    let hooks = hooks_list(&runner(), repo.path()).expect("hooks_list");
    let hook = hooks
        .iter()
        .find(|hook| hook.name == "pre-commit")
        .expect("pre-commit");
    assert!(hook.installed);
    assert!(hook.active);
    assert!(hook.sample);
}

#[test]
fn disabling_keeps_the_contents_under_disabled() {
    let repo = TestRepo::init();
    hook_write(&runner(), repo.path(), "pre-commit", "#!/bin/sh\necho hi\n").expect("write");
    hook_set_enabled(&runner(), repo.path(), "pre-commit", false).expect("disable");

    let hooks = hooks_list(&runner(), repo.path()).expect("hooks_list");
    let hook = hooks
        .iter()
        .find(|hook| hook.name == "pre-commit")
        .expect("pre-commit");
    assert!(hook.installed);
    assert!(!hook.active);
    assert!(hook.disabled);
    assert_eq!(
        hook_read(&runner(), repo.path(), "pre-commit").expect("read"),
        "#!/bin/sh\necho hi\n"
    );
}

#[test]
fn hook_read_falls_back_to_the_sample() {
    let repo = TestRepo::init();
    write_sample(&repo, "pre-commit");

    let content = hook_read(&runner(), repo.path(), "pre-commit").expect("read");
    assert!(content.contains("sample"));
}

#[test]
fn hook_write_rejects_names_that_are_not_a_single_file() {
    let repo = TestRepo::init();

    for name in [
        "",
        "..",
        ".hidden",
        "../evil",
        "a/b",
        "x.sample",
        "x.disabled",
    ] {
        let error = hook_write(&runner(), repo.path(), name, "x").expect_err("invalid name");
        assert!(
            matches!(error, GitError::InvalidOutput { .. }),
            "name {name:?} was accepted"
        );
    }
}

#[test]
fn hooks_outside_the_repository_are_listed_but_not_written() {
    let repo = TestRepo::init();
    let external = support::TempDir::new("hooks-external");
    std::fs::write(external.path().join("pre-commit.sample"), b"#!/bin/sh\n").expect("sample");
    repo.git_ok(&[
        "config",
        "core.hooksPath",
        external.path().to_str().expect("external path"),
    ]);

    let hooks = hooks_list(&runner(), repo.path()).expect("hooks_list");
    assert!(hooks
        .iter()
        .any(|hook| hook.name == "pre-commit" && hook.sample));

    let error =
        hook_set_enabled(&runner(), repo.path(), "pre-commit", true).expect_err("external path");
    assert!(matches!(error, GitError::InvalidOutput { .. }));
}
