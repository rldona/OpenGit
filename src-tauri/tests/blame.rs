mod support;

use opengit_lib::git::{blame_file, Runner};
use support::TestRepo;

fn runner() -> Runner {
    Runner::locate()
}

#[test]
fn blames_each_line_with_its_author_and_commit() {
    let repo = TestRepo::init();
    repo.write("a.txt", b"uno\ndos\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&[
        "commit",
        "-q",
        "--author=Ana <ana@example.com>",
        "-m",
        "primero",
    ]);
    repo.write("a.txt", b"uno\nDOS\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&[
        "commit",
        "-q",
        "--author=Bob <bob@example.com>",
        "-m",
        "segundo",
    ]);

    let lines = blame_file(&runner(), repo.path(), "a.txt").expect("blame");

    assert_eq!(lines.len(), 2);
    assert_eq!(lines[0].line, 1);
    assert_eq!(lines[0].content, "uno");
    assert_eq!(lines[0].author_name, "Ana");
    assert_eq!(lines[0].author_email, "ana@example.com");
    assert_eq!(lines[0].hash.len(), 40);
    assert_eq!(lines[1].line, 2);
    assert_eq!(lines[1].content, "DOS");
    assert_eq!(lines[1].author_name, "Bob");
    assert_ne!(lines[0].hash, lines[1].hash);
}

#[test]
fn blaming_an_untracked_file_is_an_error() {
    let repo = TestRepo::init();
    repo.write("tracked.txt", b"uno\n");
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", "base"]);
    repo.write("nuevo.txt", b"sin commit\n");

    let error = blame_file(&runner(), repo.path(), "nuevo.txt").expect_err("untracked file");

    let text = format!("{error}").to_lowercase();
    assert!(
        text.contains("nuevo.txt") || text.contains("no such path"),
        "{text}"
    );
}
