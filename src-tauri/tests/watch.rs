mod support;

use std::sync::mpsc;
use std::time::{Duration, Instant};

use opengit_lib::git::Runner;
use opengit_lib::watch::{start, RepoEventKind};
use support::TestRepo;

fn wait_for(rx: &mpsc::Receiver<RepoEventKind>, wanted: RepoEventKind, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok(kind) if kind == wanted => return true,
            Ok(_) => continue,
            Err(_) => continue,
        }
    }
    false
}

#[test]
fn detects_index_changes() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(Runner::locate(), repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    });
    assert!(
        watcher.wait_ready(Duration::from_secs(5)),
        "the watcher did not become ready"
    );
    repo.write("a.txt", b"dos\n");
    repo.git_ok(&["add", "a.txt"]);

    let detected = wait_for(
        &receiver,
        RepoEventKind::IndexChanged,
        Duration::from_secs(5),
    );
    watcher.stop();
    assert!(detected, "the index event did not arrive");
}

#[test]
fn detects_external_worktree_edits() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(Runner::locate(), repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    });
    assert!(
        watcher.wait_ready(Duration::from_secs(5)),
        "the watcher did not become ready"
    );
    // Edit a tracked file without running any git command.
    repo.write("a.txt", b"dos\n");

    let detected = wait_for(
        &receiver,
        RepoEventKind::WorktreeChanged,
        Duration::from_secs(5),
    );
    watcher.stop();
    assert!(detected, "the worktree event did not arrive");
}

#[test]
fn ignores_changes_inside_gitignored_directories() {
    let repo = TestRepo::init();
    repo.write(".gitignore", b"ignored/\n");
    // The directory must exist (untracked and ignored) before the watcher
    // loads the ignore set, so `git ls-files --directory` reports it.
    repo.write("ignored/seed.txt", b"uno\n");
    repo.git_ok(&["add", ".gitignore"]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(Runner::locate(), repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    });
    assert!(
        watcher.wait_ready(Duration::from_secs(5)),
        "the watcher did not become ready"
    );
    // An event buffered before the watch settled is not a change to the
    // ignored directory: let it drain before the write (OG-101).
    std::thread::sleep(Duration::from_millis(300));
    while receiver.try_recv().is_ok() {}
    repo.write("ignored/otro.txt", b"dos\n");

    let emitted = wait_for(
        &receiver,
        RepoEventKind::WorktreeChanged,
        Duration::from_secs(2),
    );
    watcher.stop();
    assert!(!emitted, "ignored changes must not refresh the worktree");
}

#[test]
fn the_pause_silences_our_own_changes() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(Runner::locate(), repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    });
    assert!(
        watcher.wait_ready(Duration::from_secs(5)),
        "the watcher did not become ready"
    );
    watcher.pause();
    repo.write("a.txt", b"tres\n");
    repo.git_ok(&["add", "a.txt"]);
    std::thread::sleep(Duration::from_millis(1000));
    assert!(receiver.try_recv().is_err(), "must not emit while paused");

    watcher.resume();
    let refreshed = wait_for(&receiver, RepoEventKind::Refreshed, Duration::from_secs(3));
    watcher.stop();
    assert!(refreshed, "expected a single refresh on resume");
}
