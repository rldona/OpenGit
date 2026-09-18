mod support;

use opengit_lib::git::patch::{parse, HunkSelection};
use opengit_lib::git::{stage_selection, worktree_diff_bytes, Runner};
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
        .unwrap_or_else(|| {
            panic!(
                "no se encontró la línea {:?}",
                String::from_utf8_lossy(needle)
            )
        })
}

#[test]
fn stage_de_un_hunk_actualiza_el_index_sin_tocar_el_worktree() {
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
    assert_eq!(parse(&diff).hunk_count(), 2, "esperaba dos hunks separados");

    stage_selection(
        &runner(),
        repo.path(),
        "a.txt",
        false,
        &HunkSelection::Hunk { index: 0 },
        false,
    )
    .expect("stage del primer hunk");

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
fn stage_de_lineas_sueltas_dentro_de_un_hunk() {
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
    .expect("stage de la línea añadida");

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
fn unstage_de_un_hunk_devuelve_el_index_a_head() {
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
    .expect("unstage del primer hunk");

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
fn crlf_y_sin_newline_final_no_se_corrompen() {
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
    .expect("stage sin newline final");

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
fn rutas_con_espacios_y_utf8() {
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
    .expect("stage en ruta con espacios y utf8");

    let cached = worktree_diff_bytes(&runner(), repo.path(), name, true).unwrap();
    assert!(String::from_utf8_lossy(&cached).contains("mi fichero.txt"));
    assert_eq!(
        repo.git_ok(&["show", &format!(":{name}")]).stdout,
        b"uno\ndos\n"
    );
}
