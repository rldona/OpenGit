mod support;

use opengit_lib::git::{image_bytes, image_mime, image_pair, Runner};
use support::TestRepo;

const TINY_PNG: &[u8] = include_bytes!("fixtures/tiny.png");
const TINY_PNG_ALT: &[u8] = include_bytes!("fixtures/tiny-alt.png");

fn runner() -> Runner {
    Runner::locate()
}

fn commit_file(repo: &TestRepo, name: &str, bytes: &[u8], message: &str) {
    repo.write(name, bytes);
    repo.git_ok(&["add", "."]);
    repo.git_ok(&["commit", "-q", "-m", message]);
}

#[test]
fn sniffs_mime_by_magic_bytes_and_extension() {
    assert_eq!(image_mime("x.bin", TINY_PNG), Some("image/png"));
    assert_eq!(
        image_mime("foto.JPG", b"\xFF\xD8\xFF\xE0"),
        Some("image/jpeg")
    );
    assert_eq!(image_mime("x.bin", b"GIF89a....."), Some("image/gif"));
    // With no known signature the extension wins (unusual containers).
    assert_eq!(image_mime("foto.avif", b"nada"), Some("image/avif"));
    assert_eq!(image_mime("foto.tiff", b"nada"), Some("image/tiff"));
    assert_eq!(image_mime("datos.bin", b"nada"), None);
}

#[test]
fn a_new_image_file_only_has_an_after_side() {
    let repo = TestRepo::init();
    commit_file(&repo, "a.txt", b"uno\n", "base");
    commit_file(&repo, "logo.png", TINY_PNG, "logo");
    let rev = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    let pair = image_pair(&runner(), repo.path(), "logo.png", Some(&rev), false).expect("pair");

    assert_eq!(pair.before, None);
    assert_eq!(pair.after.as_deref(), Some("image/png"));
    assert_eq!(
        image_bytes(
            &runner(),
            repo.path(),
            "logo.png",
            Some(&rev),
            false,
            "after"
        )
        .unwrap(),
        TINY_PNG
    );
}

#[test]
fn a_commit_with_modified_image_returns_both_sides() {
    let repo = TestRepo::init();
    commit_file(&repo, "logo.png", TINY_PNG, "logo");
    commit_file(&repo, "logo.png", TINY_PNG_ALT, "logo nuevo");
    let rev = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    let pair = image_pair(&runner(), repo.path(), "logo.png", Some(&rev), false).expect("pair");

    assert_eq!(pair.before.as_deref(), Some("image/png"));
    assert_eq!(pair.after.as_deref(), Some("image/png"));
    assert_eq!(
        image_bytes(
            &runner(),
            repo.path(),
            "logo.png",
            Some(&rev),
            false,
            "before"
        )
        .unwrap(),
        TINY_PNG
    );
    assert_eq!(
        image_bytes(
            &runner(),
            repo.path(),
            "logo.png",
            Some(&rev),
            false,
            "after"
        )
        .unwrap(),
        TINY_PNG_ALT
    );
}

#[test]
fn working_tree_compares_index_against_disk() {
    let repo = TestRepo::init();
    commit_file(&repo, "logo.png", TINY_PNG, "logo");
    repo.write("logo.png", TINY_PNG_ALT);

    let unstaged = image_pair(&runner(), repo.path(), "logo.png", None, false).expect("pair");
    assert_eq!(unstaged.before.as_deref(), Some("image/png"));
    assert_eq!(unstaged.after.as_deref(), Some("image/png"));

    repo.git_ok(&["add", "logo.png"]);
    let staged = image_pair(&runner(), repo.path(), "logo.png", None, true).expect("pair");
    assert_eq!(staged.before.as_deref(), Some("image/png"));
    assert_eq!(staged.after.as_deref(), Some("image/png"));
    assert_eq!(
        image_bytes(&runner(), repo.path(), "logo.png", None, true, "after").unwrap(),
        TINY_PNG_ALT
    );
}

#[test]
fn a_binary_that_is_not_an_image_has_no_sides() {
    let repo = TestRepo::init();
    commit_file(&repo, "datos.bin", b"\x00\x01\x02", "binario");
    let rev = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    let pair = image_pair(&runner(), repo.path(), "datos.bin", Some(&rev), false).expect("pair");

    assert_eq!(pair.before, None);
    assert_eq!(pair.after, None);
}

#[test]
fn a_deleted_image_only_has_a_before_side() {
    let repo = TestRepo::init();
    commit_file(&repo, "logo.png", TINY_PNG, "logo");
    repo.git_ok(&["rm", "-q", "logo.png"]);
    repo.git_ok(&["commit", "-q", "-m", "sin logo"]);
    let rev = String::from_utf8(repo.git_ok(&["rev-parse", "HEAD"]).stdout)
        .unwrap()
        .trim()
        .to_string();

    let pair = image_pair(&runner(), repo.path(), "logo.png", Some(&rev), false).expect("pair");

    assert_eq!(pair.before.as_deref(), Some("image/png"));
    assert_eq!(pair.after, None);
}
