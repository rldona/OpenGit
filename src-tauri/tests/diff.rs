mod support;

use opengit_lib::git::{commit_file_diff, commit_files, diff_numstat, worktree_file_diff, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn diff_de_working_tree_staged_e_invertido() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\ndos\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("a.txt", b"uno\ntres\n");
    let unstaged = worktree_file_diff(&runner(), repo.path(), "a.txt", false, false).unwrap();
    assert!(unstaged.contains("-dos"), "{unstaged}");
    assert!(unstaged.contains("+tres"));
    assert!(unstaged.contains("@@"));

    repo.git_ok(&["add", "a.txt"]);
    let staged = worktree_file_diff(&runner(), repo.path(), "a.txt", true, false).unwrap();
    assert!(staged.contains("+tres"));

    let reversed = worktree_file_diff(&runner(), repo.path(), "a.txt", true, true).unwrap();
    assert!(reversed.contains("-tres"), "{reversed}");
    assert!(reversed.contains("+dos"));
}

#[test]
fn diff_de_commit_con_renombrado() {
    let repo = TestRepo::init();
    repo.write("viejo.txt", b"contenido\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.git_ok(&["mv", "viejo.txt", "nuevo.txt"]);
    repo.write("nuevo.txt", b"contenido\nmas\n");
    repo.git_ok(&["commit", "-q", "-am", "rename y cambio"]);

    let files = commit_files(&runner(), repo.path(), "HEAD").expect("ficheros del commit");
    let renamed = files
        .iter()
        .find(|file| file.path == "nuevo.txt")
        .expect("renombrado");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));

    let patch = commit_file_diff(&runner(), repo.path(), "HEAD", "nuevo.txt", false).unwrap();
    assert!(patch.contains("+mas"), "{patch}");
}

#[test]
fn diff_de_binarios_avisa() {
    let repo = TestRepo::init();
    repo.write("bin.bin", b"\x00\x01\x02");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("bin.bin", b"\x00\x03\x04");

    let patch = worktree_file_diff(&runner(), repo.path(), "bin.bin", false, false).unwrap();
    assert!(patch.contains("Binary files"), "{patch}");
}

#[test]
fn numstat_del_working_tree() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("a.txt", b"uno\nmas\n");

    let diffs = diff_numstat(&runner(), repo.path(), false).expect("numstat");
    let entry = diffs
        .iter()
        .find(|diff| diff.path == "a.txt")
        .expect("entrada");
    assert_eq!(entry.added, Some(1));
    assert_eq!(entry.deleted, Some(0));
}
