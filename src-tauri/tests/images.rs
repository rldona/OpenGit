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
fn sniffa_el_mime_por_magic_bytes_y_por_extension() {
    assert_eq!(image_mime("x.bin", TINY_PNG), Some("image/png"));
    assert_eq!(
        image_mime("foto.JPG", b"\xFF\xD8\xFF\xE0"),
        Some("image/jpeg")
    );
    assert_eq!(image_mime("x.bin", b"GIF89a....."), Some("image/gif"));
    // Sin firma conocida manda la extensión (contenedores raros).
    assert_eq!(image_mime("foto.avif", b"nada"), Some("image/avif"));
    assert_eq!(image_mime("foto.tiff", b"nada"), Some("image/tiff"));
    assert_eq!(image_mime("datos.bin", b"nada"), None);
}

#[test]
fn un_fichero_de_imagen_nuevo_solo_tiene_lado_after() {
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
fn un_commit_con_imagen_modificada_devuelve_los_dos_lados() {
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
fn el_working_tree_compara_index_contra_disco() {
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
fn un_binario_que_no_es_imagen_no_tiene_lados() {
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
fn una_imagen_borrada_solo_tiene_lado_before() {
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
