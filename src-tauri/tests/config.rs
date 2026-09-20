mod support;

use opengit_lib::git::{
    commit_template_read, commit_template_write, config_get, config_set, config_unset,
    ignore_exclude_path, read_text_file, ConfigScope, Runner,
};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn config_round_trips_in_the_local_scope() {
    let repo = TestRepo::init();
    let runner = runner();

    assert_eq!(
        config_get(&runner, repo.path(), "user.signingkey", ConfigScope::Local).expect("get"),
        None
    );

    config_set(
        &runner,
        repo.path(),
        "user.signingkey",
        "ABC123",
        ConfigScope::Local,
    )
    .expect("set");
    assert_eq!(
        config_get(&runner, repo.path(), "user.signingkey", ConfigScope::Local)
            .expect("get")
            .as_deref(),
        Some("ABC123")
    );

    config_set(
        &runner,
        repo.path(),
        "user.signingkey",
        "DEF456",
        ConfigScope::Local,
    )
    .expect("overwrite");
    assert_eq!(
        config_get(&runner, repo.path(), "user.signingkey", ConfigScope::Local)
            .expect("get")
            .as_deref(),
        Some("DEF456")
    );

    config_unset(&runner, repo.path(), "user.signingkey", ConfigScope::Local).expect("unset");
    assert_eq!(
        config_get(&runner, repo.path(), "user.signingkey", ConfigScope::Local).expect("get"),
        None
    );
    // Unsetting a missing key is not an error.
    config_unset(&runner, repo.path(), "user.signingkey", ConfigScope::Local).expect("unset twice");
}

#[test]
fn config_values_with_spaces_survive_the_round_trip() {
    let repo = TestRepo::init();
    let runner = runner();

    config_set(
        &runner,
        repo.path(),
        "user.name",
        "Raúl López",
        ConfigScope::Local,
    )
    .expect("set");
    assert_eq!(
        config_get(&runner, repo.path(), "user.name", ConfigScope::Local)
            .expect("get")
            .as_deref(),
        Some("Raúl López")
    );
}

#[test]
fn invalid_config_keys_are_rejected() {
    let repo = TestRepo::init();
    let runner = runner();

    let error = config_set(
        &runner,
        repo.path(),
        "user.name; rm -rf",
        "x",
        ConfigScope::Local,
    );
    assert!(error.is_err());
}

#[test]
fn commit_template_round_trips_and_points_the_config_at_it() {
    let repo = TestRepo::init();
    let runner = runner();

    assert_eq!(
        commit_template_read(&runner, repo.path()).expect("read"),
        ""
    );

    let path = commit_template_write(&runner, repo.path(), "feat: \n").expect("write");
    assert!(path.ends_with("commit-template.txt"));
    assert_eq!(
        commit_template_read(&runner, repo.path()).expect("read"),
        "feat: \n"
    );
    assert_eq!(
        config_get(&runner, repo.path(), "commit.template", ConfigScope::Local)
            .expect("get")
            .as_deref(),
        Some(path.as_str())
    );
}

#[test]
fn commit_template_read_follows_the_configured_file() {
    let repo = TestRepo::init();
    let runner = runner();
    repo.write("template.txt", b"custom\n");
    config_set(
        &runner,
        repo.path(),
        "commit.template",
        "template.txt",
        ConfigScope::Local,
    )
    .expect("set");

    assert_eq!(
        commit_template_read(&runner, repo.path()).expect("read"),
        "custom\n"
    );
}

#[test]
fn read_text_file_rejects_a_missing_file() {
    assert!(read_text_file("/nope/definitely-missing.txt").is_err());
}

#[test]
fn ignore_exclude_path_points_at_the_git_directory() {
    let repo = TestRepo::init();

    let path = ignore_exclude_path(&runner(), repo.path()).expect("path");

    assert!(path.ends_with("info/exclude"), "unexpected path: {path}");
    assert!(path.starts_with(&repo.path().to_string_lossy().to_string()));
}
