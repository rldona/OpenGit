//! Opening files in external applications (OG-078). Only error paths are
//! tested: success would launch a GUI editor on the test machine.

use opengit_lib::commands::open_editor;

#[test]
fn open_editor_rejects_a_missing_file_without_spawning() {
    let error = open_editor("/definitely/not/here.txt".to_string()).expect_err("must fail");
    let message = format!("{error:?}");
    assert!(message.contains("does not exist"), "{message}");
}
