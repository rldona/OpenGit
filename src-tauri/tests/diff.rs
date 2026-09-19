mod support;

use opengit_lib::git::{
    commit_file_diff, commit_files, compare_file_diff, compare_numstat, diff_numstat,
    untracked_file_diff, worktree_file_diff, Runner,
};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn diff_of_working_tree_staged_and_reversed() {
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
fn diff_of_commit_with_rename() {
    let repo = TestRepo::init();
    repo.write("viejo.txt", b"contenido\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.git_ok(&["mv", "viejo.txt", "nuevo.txt"]);
    repo.write("nuevo.txt", b"contenido\nmas\n");
    repo.git_ok(&["commit", "-q", "-am", "rename y cambio"]);

    let files = commit_files(&runner(), repo.path(), "HEAD").expect("commit files");
    let renamed = files
        .iter()
        .find(|file| file.path == "nuevo.txt")
        .expect("renamed");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));

    let patch = commit_file_diff(&runner(), repo.path(), "HEAD", "nuevo.txt", false).unwrap();
    assert!(patch.contains("+mas"), "{patch}");
}

#[test]
fn diff_of_binaries_warns() {
    let repo = TestRepo::init();
    repo.write("bin.bin", b"\x00\x01\x02");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("bin.bin", b"\x00\x03\x04");

    let patch = worktree_file_diff(&runner(), repo.path(), "bin.bin", false, false).unwrap();
    assert!(patch.contains("Binary files"), "{patch}");
}

#[test]
fn diff_of_untracked_text_binary_empty_and_missing() {
    let repo = TestRepo::init();
    repo.write("nuevo.txt", b"hola\nmundo\n");
    repo.write("añadido.txt", "con eñe\n".as_bytes());
    repo.write("bin.bin", b"\x00\x01\x02");
    repo.write("vacio.txt", b"");

    let patch = untracked_file_diff(&runner(), repo.path(), "nuevo.txt").unwrap();
    assert!(patch.contains("--- /dev/null"), "{patch}");
    assert!(patch.contains("+++ b/nuevo.txt"), "{patch}");
    assert!(patch.contains("+hola"), "{patch}");
    assert!(patch.contains("+mundo"), "{patch}");

    let non_ascii = untracked_file_diff(&runner(), repo.path(), "añadido.txt").unwrap();
    assert!(non_ascii.contains("+con eñe"), "{non_ascii}");

    let binary = untracked_file_diff(&runner(), repo.path(), "bin.bin").unwrap();
    assert!(binary.contains("Binary files"), "{binary}");

    let empty = untracked_file_diff(&runner(), repo.path(), "vacio.txt").unwrap();
    assert!(empty.contains("new file"), "{empty}");
    assert!(!empty.contains("@@"), "{empty}");

    assert!(untracked_file_diff(&runner(), repo.path(), "noexiste.txt").is_err());
}

#[test]
fn numstat_of_working_tree() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("a.txt", b"uno\nmas\n");

    let diffs = diff_numstat(&runner(), repo.path(), false).expect("numstat");
    let entry = diffs
        .iter()
        .find(|diff| diff.path == "a.txt")
        .expect("entry");
    assert_eq!(entry.added, Some(1));
    assert_eq!(entry.deleted, Some(0));
}

#[test]
fn compares_two_revisions_with_added_deleted_and_renamed_files() {
    let repo = TestRepo::init();
    repo.write("keep.txt", b"uno\n");
    repo.write("gone.txt", b"adios\n");
    repo.write("viejo.txt", b"contenido\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    let base = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    repo.git_ok(&["rm", "-q", "gone.txt"]);
    repo.git_ok(&["mv", "viejo.txt", "nuevo.txt"]);
    repo.write("añadido.txt", b"nuevo\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "cambios"]);

    let files = compare_numstat(&runner(), repo.path(), &base, "HEAD").expect("compare numstat");
    let paths: Vec<&str> = files.iter().map(|file| file.path.as_str()).collect();
    assert!(paths.contains(&"gone.txt"), "{paths:?}");
    assert!(paths.contains(&"añadido.txt"), "{paths:?}");
    let renamed = files
        .iter()
        .find(|file| file.path == "nuevo.txt")
        .expect("renamed");
    assert_eq!(renamed.orig_path.as_deref(), Some("viejo.txt"));

    let patch =
        compare_file_diff(&runner(), repo.path(), &base, "HEAD", "añadido.txt", false).unwrap();
    assert!(patch.contains("+nuevo"), "{patch}");

    let reversed =
        compare_file_diff(&runner(), repo.path(), &base, "HEAD", "añadido.txt", true).unwrap();
    assert!(reversed.contains("-nuevo"), "{reversed}");
}
