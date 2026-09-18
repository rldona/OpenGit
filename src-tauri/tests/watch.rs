mod support;

use std::sync::mpsc;
use std::time::{Duration, Instant};

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
fn detecta_cambios_del_index() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    })
    .expect("arrancar watcher");
    std::thread::sleep(Duration::from_millis(300));

    repo.write("a.txt", b"dos\n");
    repo.git_ok(&["add", "a.txt"]);

    let detected = wait_for(
        &receiver,
        RepoEventKind::IndexChanged,
        Duration::from_secs(5),
    );
    watcher.stop();
    assert!(detected, "no llegó el evento de index");
}

#[test]
fn la_pausa_silencia_los_cambios_propios() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let (sender, receiver) = mpsc::channel();
    let watcher = start(repo.path().to_path_buf(), move |kind| {
        let _ = sender.send(kind);
    })
    .expect("arrancar watcher");
    std::thread::sleep(Duration::from_millis(300));

    watcher.pause();
    repo.write("a.txt", b"tres\n");
    repo.git_ok(&["add", "a.txt"]);
    std::thread::sleep(Duration::from_millis(500));
    assert!(receiver.try_recv().is_err(), "no debe emitir en pausa");

    watcher.resume();
    let refreshed = wait_for(&receiver, RepoEventKind::Refreshed, Duration::from_secs(3));
    watcher.stop();
    assert!(refreshed, "esperaba un refresco único al reanudar");
}
