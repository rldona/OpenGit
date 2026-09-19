mod support;

use std::time::Duration;

use opengit_lib::git::{
    diff_numstat, has_commits, log_page, refs, status, GitCommand, GitError, Runner,
};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn git_version_meets_the_minimum() {
    let version = runner().version().expect("read the git version");
    assert!(version.meets_minimum(), "git {version} es menor que 2.34");
}

#[test]
fn runs_args_with_spaces_quotes_and_utf8() {
    let repo = TestRepo::init();
    repo.write("carpeta con espacios/ñandú 日本.txt", b"hola\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "raíz: cita \"doble\" y ñ"]);

    let log = runner()
        .run_checked(&GitCommand::new(["log", "-z", "--format=%s"]).cwd(repo.path()))
        .expect("git log");
    let subjects = String::from_utf8_lossy(&log.stdout);
    assert!(subjects.contains("cita \"doble\" y ñ"), "{subjects}");

    repo.write("carpeta con espacios/ñandú 日本.txt", b"hola\nmodificado\n");
    let status = runner()
        .run_checked(&GitCommand::new(["status", "--porcelain=v2", "-z"]).cwd(repo.path()))
        .expect("git status");
    let entries = String::from_utf8_lossy(&status.stdout);
    assert!(
        entries.contains("carpeta con espacios/ñandú 日本.txt"),
        "{entries}"
    );
}

#[test]
fn git_error_arrives_with_stderr_and_code() {
    let repo = TestRepo::init();
    let error = runner()
        .run_checked(
            &GitCommand::new(["rev-parse", "--verify", "refs/heads/no-existe"]).cwd(repo.path()),
        )
        .expect_err("rev-parse debe fallar");

    match error {
        GitError::CommandFailed {
            exit_code,
            stdout,
            stderr,
            args,
        } => {
            assert_ne!(exit_code, 0);
            assert!(!stdout.is_empty() || !stderr.is_empty());
            assert_eq!(args.first().map(String::as_str), Some("rev-parse"));
        }
        other => panic!("expected CommandFailed, got {other:?}"),
    }
}

#[test]
fn run_unchecked_returns_output_on_failure() {
    let repo = TestRepo::init();
    let output = runner()
        .run(&GitCommand::new(["rev-parse", "--verify", "refs/heads/no-existe"]).cwd(repo.path()))
        .expect("run no comprueba el exit code");
    assert!(!output.success());
    assert_ne!(output.exit_code(), 0);
}

#[test]
fn stdin_bytes_reaches_the_process() {
    let repo = TestRepo::init();
    let output = runner()
        .run_checked(
            &GitCommand::new(["hash-object", "--stdin"])
                .cwd(repo.path())
                .stdin_bytes(b"contenido de prueba".to_vec()),
        )
        .expect("hash-object");
    assert_eq!(output.stdout_lossy().trim().len(), 40);
}

#[test]
fn timeout_kills_the_process_without_orphans() {
    let repo = TestRepo::init();
    let command = GitCommand::new(["cat-file", "--batch"])
        .cwd(repo.path())
        .keep_stdin_open()
        .timeout(Duration::from_millis(200));
    let process = runner().spawn(&command).expect("spawn");
    let pid = process.pid();

    let error = process
        .wait(Duration::from_millis(200))
        .expect_err("must exhaust the timeout");
    assert!(matches!(error, GitError::Timeout { .. }), "got {error:?}");
    assert_process_gone(pid);
}

#[test]
fn cancelling_leaves_no_orphans() {
    let repo = TestRepo::init();
    let command = GitCommand::new(["cat-file", "--batch"])
        .cwd(repo.path())
        .keep_stdin_open();
    let mut process = runner().spawn(&command).expect("spawn");
    let pid = process.pid();

    std::thread::sleep(Duration::from_millis(150));
    process.cancel().expect("cancelar");
    let error = process
        .wait(Duration::from_secs(5))
        .expect_err("must finish cancelled");
    assert!(matches!(error, GitError::Cancelled { .. }), "got {error:?}");
    assert_process_gone(pid);
}

#[test]
fn log_page_does_not_include_stash_internal_commits() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("a.txt", b"dos\n");
    repo.git_ok(&["stash", "push", "-m", "guardado"]);

    let commits = log_page(&runner(), repo.path(), 0, 50, None, None).expect("log page");

    // `git log --all` would drag `refs/stash` in: the stash commit and its inner
    // "index on <branch>: …" commit, which have no place in the history.
    assert_eq!(commits.len(), 1, "only the base commit should be listed");
    assert_eq!(commits[0].subject, "base");
    assert!(
        !commits.iter().any(|commit| commit
            .refs
            .iter()
            .any(|reference| reference.contains("stash"))),
        "ninguna ref de stash debe llegar al historial"
    );

    // And the stash still exists: what changes is the history, not the repo.
    let stash_list = repo.git_ok(&["stash", "list"]);
    assert!(!String::from_utf8_lossy(&stash_list.stdout)
        .trim()
        .is_empty());
}

#[test]
fn status_and_log_page_on_real_repo() {
    let repo = TestRepo::init();
    assert!(!has_commits(&runner(), repo.path()).expect("has_commits"));

    for (index, name) in ["a.txt", "b.txt", "c.txt"].iter().enumerate() {
        repo.write(name, format!("contenido {index}\n").as_bytes());
        repo.git_ok(&["add", "."]);
        repo.git_ok(&["commit", "-q", "-m", &format!("commit {index}")]);
    }

    assert!(has_commits(&runner(), repo.path()).expect("has_commits"));

    let first_page = log_page(&runner(), repo.path(), 0, 2, None, None).expect("log page 1");
    assert_eq!(first_page.len(), 2);
    assert_eq!(first_page[0].subject, "commit 2");
    let second_page = log_page(&runner(), repo.path(), 2, 2, None, None).expect("log page 2");
    assert_eq!(second_page.len(), 1);

    repo.write("b.txt", b"modificado\n");
    repo.write("nuevo.txt", b"sin trackear\n");
    repo.git_ok(&["add", "nuevo.txt"]);

    let report = status(&runner(), repo.path()).expect("status");
    assert_eq!(report.branch.as_deref(), Some("main"));
    assert!(report
        .entries
        .iter()
        .any(|entry| entry.path == "b.txt" && entry.xy == ".M"));
    assert!(report
        .entries
        .iter()
        .any(|entry| entry.path == "nuevo.txt" && entry.xy == "A."));

    let staged = diff_numstat(&runner(), repo.path(), true).expect("numstat cached");
    assert!(staged.iter().any(|diff| diff.path == "nuevo.txt"));
}

#[test]
fn log_page_filters_by_ref() {
    let repo = TestRepo::init();
    repo.write("base.txt", b"base\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "commit base"]);
    repo.git_ok(&["checkout", "-q", "-b", "feature"]);
    repo.write("feature.txt", b"feature\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "commit feature"]);
    repo.git_ok(&["checkout", "-q", "main"]);
    repo.write("main.txt", b"main\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "commit main"]);

    let all = log_page(&runner(), repo.path(), 0, 50, None, None).expect("todas las refs");
    assert_eq!(all.len(), 3);

    let feature =
        log_page(&runner(), repo.path(), 0, 50, Some("feature"), None).expect("solo feature");
    assert_eq!(feature.len(), 2);
    assert_eq!(feature[0].subject, "commit feature");
    assert_eq!(feature[1].subject, "commit base");
}

#[test]
fn refs_on_real_repo() {
    let repo = TestRepo::init();
    repo.write("x.txt", b"x\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.git_ok(&["branch", "feature"]);
    repo.git_ok(&["tag", "v0.1.0"]);

    let refs = refs(&runner(), repo.path()).expect("refs");
    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/heads/main"));
    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/heads/feature"));
    assert!(refs
        .iter()
        .any(|reference| reference.name == "refs/tags/v0.1.0"));
}

#[cfg(unix)]
fn assert_process_gone(pid: u32) {
    std::thread::sleep(Duration::from_millis(100));
    let alive = unsafe { libc::kill(pid as i32, 0) } == 0;
    assert!(!alive, "process {pid} is still alive");
}

#[cfg(not(unix))]
fn assert_process_gone(_pid: u32) {}
