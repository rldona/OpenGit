mod support;

use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use opengit_lib::git::Runner;
use opengit_lib::jobs::{start, JobKind, JobManager, RemoteJobEvent};
use support::{git, TempDir, TestRepo};

fn runner() -> Runner {
    Runner::locate()
}

fn init_bare(dir: &TempDir) {
    // `-b main` explícito: sin init.defaultBranch, CI crea master y el clon
    // no seguiría la rama que empujamos.
    let output = git(dir.path(), &["init", "--bare", "-b", "main", "-q"]);
    assert!(output.status.success());
}

fn commit_file(repo: &TestRepo, name: &str, content: &str, message: &str) {
    repo.write(name, content.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

fn spawn_job(repo: &TestRepo, kind: JobKind) -> (String, mpsc::Receiver<RemoteJobEvent>) {
    let manager = JobManager::new();
    let id = manager.next_id();
    let (sender, receiver) = mpsc::channel();
    let sender = Arc::new(Mutex::new(sender));
    start(&manager, &id, &runner(), repo.path(), &kind, move |event| {
        let _ = sender.lock().unwrap().send(event);
    })
    .expect("arrancar job");
    (id, receiver)
}

fn collect_until_finished(
    receiver: &mpsc::Receiver<RemoteJobEvent>,
    timeout: Duration,
) -> (Vec<String>, Option<(bool, bool)>) {
    let deadline = Instant::now() + timeout;
    let mut lines = Vec::new();
    while Instant::now() < deadline {
        match receiver.recv_timeout(Duration::from_millis(200)) {
            Ok(RemoteJobEvent::Output { line, .. }) => lines.push(line),
            Ok(RemoteJobEvent::Finished {
                success, cancelled, ..
            }) => return (lines, Some((success, cancelled))),
            Err(_) => continue,
        }
    }
    (lines, None)
}

#[test]
fn push_transmite_salida_y_configura_upstream() {
    let remote = TempDir::new("bare-push");
    init_bare(&remote);
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
    repo.git_ok(&["remote", "add", "origin", remote.path().to_str().unwrap()]);

    let (_id, receiver) = spawn_job(
        &repo,
        JobKind::Push {
            remote: Some("origin".into()),
            set_upstream: true,
        },
    );

    let (lines, finished) = collect_until_finished(&receiver, Duration::from_secs(20));

    let (success, cancelled) = finished.expect("evento de fin");
    assert!(success, "el push debe funcionar: {lines:?}");
    assert!(!cancelled);
    assert!(!lines.is_empty(), "se esperaba salida en streaming");

    assert!(
        git(remote.path(), &["rev-parse", "--verify", "refs/heads/main"])
            .status
            .success()
    );
    assert_eq!(
        repo.git_ok(&[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}"
        ])
        .stdout,
        b"origin/main\n"
    );
}

#[test]
fn fetch_actualiza_las_refs_remotas() {
    let remote = TempDir::new("bare-fetch");
    init_bare(&remote);
    let a = TestRepo::init();
    commit_file(&a, "a.txt", "uno\n", "c1");
    a.git_ok(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    a.git_ok(&["push", "-q", "--set-upstream", "origin", "main"]);

    let clones = TempDir::new("clones");
    let b_path = clones.path().join("b");
    let cloned = git(
        clones.path(),
        &[
            "clone",
            "--branch",
            "main",
            remote.path().to_str().unwrap(),
            "b",
        ],
    );
    assert!(
        cloned.status.success(),
        "{}",
        String::from_utf8_lossy(&cloned.stderr)
    );

    commit_file(&a, "a.txt", "dos\n", "c2");
    a.git_ok(&["push", "-q"]);

    let b = TestRepo::at(&b_path);
    let (_id, receiver) = spawn_job(
        &b,
        JobKind::Fetch {
            prune: false,
            remote: Some("origin".into()),
        },
    );
    let (lines, finished) = collect_until_finished(&receiver, Duration::from_secs(20));
    let (success, _) = finished.expect("evento de fin");
    assert!(success, "el fetch debe funcionar: {lines:?}");

    let remote_main =
        String::from_utf8(b.git_ok(&["rev-parse", "refs/remotes/origin/main"]).stdout).unwrap();
    let a_main = String::from_utf8(a.git_ok(&["rev-parse", "HEAD"]).stdout).unwrap();
    assert_eq!(remote_main, a_main);
}

#[test]
fn pull_mergea_los_cambios_del_remoto() {
    let remote = TempDir::new("bare-pull");
    init_bare(&remote);
    let a = TestRepo::init();
    commit_file(&a, "a.txt", "uno\n", "c1");
    a.git_ok(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    a.git_ok(&["push", "-q", "--set-upstream", "origin", "main"]);

    let clones = TempDir::new("clones-pull");
    let b_path = clones.path().join("b");
    let cloned = git(
        clones.path(),
        &[
            "clone",
            "--branch",
            "main",
            remote.path().to_str().unwrap(),
            "b",
        ],
    );
    assert!(cloned.status.success());

    commit_file(&a, "a.txt", "dos\n", "c2");
    a.git_ok(&["push", "-q"]);

    let b = TestRepo::at(&b_path);
    let (_id, receiver) = spawn_job(
        &b,
        JobKind::Pull {
            remote: Some("origin".into()),
            branch: Some("main".into()),
            rebase: false,
            no_ff: false,
            no_commit: false,
            include_messages: false,
        },
    );
    let (lines, finished) = collect_until_finished(&receiver, Duration::from_secs(20));
    let (success, _) = finished.expect("evento de fin");
    assert!(success, "el pull debe funcionar: {lines:?}");

    let b_head = String::from_utf8(b.git_ok(&["rev-parse", "HEAD"]).stdout).unwrap();
    let a_head = String::from_utf8(a.git_ok(&["rev-parse", "HEAD"]).stdout).unwrap();
    assert_eq!(b_head, a_head);
}

#[test]
fn push_rechazado_por_non_fast_forward() {
    let remote = TempDir::new("bare-nff");
    init_bare(&remote);
    let a = TestRepo::init();
    commit_file(&a, "a.txt", "uno\n", "c1");
    a.git_ok(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    a.git_ok(&["push", "-q", "--set-upstream", "origin", "main"]);

    let clones = TempDir::new("clones-nff");
    let b_path = clones.path().join("b");
    let cloned = git(
        clones.path(),
        &[
            "clone",
            "--branch",
            "main",
            remote.path().to_str().unwrap(),
            "b",
        ],
    );
    assert!(cloned.status.success());

    commit_file(&a, "a.txt", "dos\n", "c2 de a");
    a.git_ok(&["push", "-q"]);

    let b = TestRepo::at(&b_path);
    commit_file(&b, "b.txt", "b\n", "c2 de b");
    let (_id, receiver) = spawn_job(
        &b,
        JobKind::Push {
            remote: Some("origin".into()),
            set_upstream: false,
        },
    );
    let (lines, finished) = collect_until_finished(&receiver, Duration::from_secs(20));
    let (success, _) = finished.expect("evento de fin");

    assert!(!success, "el push debe rechazarse: {lines:?}");
    let text = lines.join("\n");
    assert!(
        text.contains("rejected")
            || text.contains("non-fast-forward")
            || text.contains("fetch first"),
        "{text}"
    );
}

#[test]
fn cancelar_un_push_no_deja_huerfanos() {
    let remote = TempDir::new("bare-cancel");
    init_bare(&remote);
    let hook = remote.path().join("hooks/pre-receive");
    std::fs::write(&hook, b"#!/bin/sh\nsleep 10\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", "uno\n", "c1");
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
        &JobKind::Push {
            remote: Some("origin".into()),
            set_upstream: true,
        },
        move |event| {
            let _ = sender.lock().unwrap().send(event);
        },
    )
    .expect("arrancar job");

    // Espera a que el push arranque (primeras líneas del progreso).
    let started = Instant::now();
    while started.elapsed() < Duration::from_secs(10) {
        if let Ok(RemoteJobEvent::Output { .. }) = receiver.recv_timeout(Duration::from_millis(200))
        {
            break;
        }
    }

    assert!(manager.cancel(&id), "el job debe estar registrado");
    let (lines, finished) = collect_until_finished(&receiver, Duration::from_secs(5));
    let (success, cancelled) = finished.expect("evento de fin tras cancelar");

    assert!(!success);
    assert!(cancelled, "debe llegar como cancelado: {lines:?}");
    assert!(
        started.elapsed() < Duration::from_secs(9),
        "no debe esperar al hook"
    );
    assert!(
        !git(remote.path(), &["rev-parse", "--verify", "refs/heads/main"])
            .status
            .success()
    );
}
