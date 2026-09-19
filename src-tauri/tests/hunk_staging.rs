mod support;

use opengit_lib::git::patch::{parse, HunkSelection};
use opengit_lib::git::{discard_selection, stage_selection, worktree_diff_bytes, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

fn numbered_file(count: usize) -> String {
    (1..=count)
        .map(|index| format!("linea {index}\n"))
        .collect::<Vec<_>>()
        .join("")
}

fn line_index(patch: &[u8], needle: &[u8]) -> usize {
    patch
        .split(|byte| *byte == b'\n')
        .position(|line| line == needle)
        .unwrap_or_else(|| panic!("line {:?} not found", String::from_utf8_lossy(needle)))
}

#[test]
fn staging_a_hunk_updates_the_index_without_touching_the_worktree() {
    let repo = TestRepo::init();
    let original = numbered_file(20);
    repo.write("a.txt", original.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let modified = original
        .replace("linea 2\n", "LINEA 2\n")
        .replace("linea 18\n", "LINEA 18\n");
    repo.write("a.txt", modified.as_bytes());

    let diff = worktree_diff_bytes(&runner(), repo.path(), "a.txt", false).unwrap();
    assert_eq!(parse(&diff).hunk_count(), 2, "expected two separate hunks");

    stage_selection(
        &runner(),
        repo.path(),
        "a.txt",
        false,
        &HunkSelection::Hunk { index: 0 },
        false,
    )
    .expect("stage first hunk");

    let cached =
        String::from_utf8(worktree_diff_bytes(&runner(), repo.path(), "a.txt", true).unwrap())
            .unwrap();
    assert!(cached.contains("+LINEA 2"), "{cached}");
    assert!(!cached.contains("LINEA 18"), "{cached}");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        modified
    );
    let remaining =
        String::from_utf8(worktree_diff_bytes(&runner(), repo.path(), "a.txt", false).unwrap())
            .unwrap();
    assert!(remaining.contains("LINEA 18"));
    assert!(!remaining.contains("LINEA 2"));
}

#[test]
fn staging_individual_lines_within_a_hunk() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\ndos\ntres\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("a.txt", b"uno\nDOS\ntres\ncuatro\n");
    let diff = worktree_diff_bytes(&runner(), repo.path(), "a.txt", false).unwrap();
    let add_index = line_index(&diff, b"+cuatro");

    stage_selection(
        &runner(),
        repo.path(),
        "a.txt",
        false,
        &HunkSelection::Lines {
            indices: vec![add_index],
        },
        false,
    )
    .expect("stage added line");

    let cached =
        String::from_utf8(worktree_diff_bytes(&runner(), repo.path(), "a.txt", true).unwrap())
            .unwrap();
    assert!(cached.contains("+cuatro"), "{cached}");
    assert!(!cached.contains("+DOS"), "{cached}");
    assert!(!cached.contains("-dos"), "{cached}");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "uno\nDOS\ntres\ncuatro\n"
    );
}

#[test]
fn unstaging_a_hunk_returns_the_index_to_head() {
    let repo = TestRepo::init();
    let original = numbered_file(20);
    repo.write("a.txt", original.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let modified = original
        .replace("linea 2\n", "LINEA 2\n")
        .replace("linea 18\n", "LINEA 18\n");
    repo.write("a.txt", modified.as_bytes());
    repo.git_ok(&["add", "a.txt"]);

    let cached = worktree_diff_bytes(&runner(), repo.path(), "a.txt", true).unwrap();
    assert_eq!(parse(&cached).hunk_count(), 2);

    stage_selection(
        &runner(),
        repo.path(),
        "a.txt",
        true,
        &HunkSelection::Hunk { index: 0 },
        true,
    )
    .expect("unstage first hunk");

    let after =
        String::from_utf8(worktree_diff_bytes(&runner(), repo.path(), "a.txt", true).unwrap())
            .unwrap();
    assert!(!after.contains("LINEA 2"), "{after}");
    assert!(after.contains("LINEA 18"), "{after}");
    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        modified
    );
}

#[test]
fn crlf_and_missing_final_newline_do_not_get_corrupted() {
    let repo = TestRepo::init();
    repo.write("crlf.txt", b"a\r\nb\r\nc\r\n");
    repo.write("nonl.txt", b"sin newline");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("crlf.txt", b"a\r\nB\r\nc\r\n");
    repo.write("nonl.txt", b"sin newline CAMBIADO");

    stage_selection(
        &runner(),
        repo.path(),
        "crlf.txt",
        false,
        &HunkSelection::Hunk { index: 0 },
        false,
    )
    .expect("stage crlf");
    stage_selection(
        &runner(),
        repo.path(),
        "nonl.txt",
        false,
        &HunkSelection::Hunk { index: 0 },
        false,
    )
    .expect("stage without final newline");

    assert_eq!(
        repo.git_ok(&["show", ":crlf.txt"]).stdout,
        b"a\r\nB\r\nc\r\n"
    );
    assert_eq!(
        repo.git_ok(&["show", ":nonl.txt"]).stdout,
        b"sin newline CAMBIADO"
    );
    assert_eq!(
        std::fs::read(repo.path().join("crlf.txt")).unwrap(),
        b"a\r\nB\r\nc\r\n"
    );
    assert_eq!(
        std::fs::read(repo.path().join("nonl.txt")).unwrap(),
        b"sin newline CAMBIADO"
    );
}

#[test]
fn paths_with_spaces_and_utf8() {
    let repo = TestRepo::init();
    let name = "carpeta ñ/mi fichero.txt";
    repo.write(name, b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write(name, b"uno\ndos\n");

    stage_selection(
        &runner(),
        repo.path(),
        name,
        false,
        &HunkSelection::Hunk { index: 0 },
        false,
    )
    .expect("stage path with spaces and utf8");

    let cached = worktree_diff_bytes(&runner(), repo.path(), name, true).unwrap();
    assert!(String::from_utf8_lossy(&cached).contains("mi fichero.txt"));
    assert_eq!(
        repo.git_ok(&["show", &format!(":{name}")]).stdout,
        b"uno\ndos\n"
    );
}

#[test]
fn discarding_a_hunk_only_reverts_that_hunk() {
    let repo = TestRepo::init();
    let original = numbered_file(20);
    repo.write("a.txt", original.as_bytes());
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    let modified = original
        .replace("linea 2\n", "LINEA 2\n")
        .replace("linea 18\n", "LINEA 18\n");
    repo.write("a.txt", modified.as_bytes());

    assert!(
        discard_selection(&runner(), repo.path(), "a.txt", &HunkSelection::File).is_err(),
        "full discard is not resolved with patches"
    );

    discard_selection(
        &runner(),
        repo.path(),
        "a.txt",
        &HunkSelection::Hunk { index: 0 },
    )
    .expect("discard first hunk");

    let content = std::fs::read_to_string(repo.path().join("a.txt")).unwrap();
    assert!(content.contains("linea 2\n"), "{content}");
    assert!(!content.contains("LINEA 2"), "{content}");
    assert!(content.contains("LINEA 18"), "{content}");

    let cached = worktree_diff_bytes(&runner(), repo.path(), "a.txt", true).unwrap();
    assert!(cached.is_empty(), "the index must not change");
}

#[test]
fn discarding_lines_keeps_unselected_ones() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\ndos\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);

    repo.write("a.txt", b"uno\ndos\ntres\ncuatro\n");
    let diff = worktree_diff_bytes(&runner(), repo.path(), "a.txt", false).unwrap();
    let index = line_index(&diff, b"+tres");

    discard_selection(
        &runner(),
        repo.path(),
        "a.txt",
        &HunkSelection::Lines {
            indices: vec![index],
        },
    )
    .expect("discard one line");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("a.txt")).unwrap(),
        "uno\ndos\ncuatro\n"
    );
}
