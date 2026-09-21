//! Native application menu and its per-locale labels (OG-106).
//!
//! The frontend keeps the message catalog; this small table is mirrored in
//! Rust because the menu has to be rebuildable without the webview. Item ids
//! are stable, so rebuilding the menu for another locale does not change the
//! `menu-action` routing.

use tauri::menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::AppHandle;

/// Labels of the native menu for a locale.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MenuLabels {
    pub app: &'static str,
    pub check_updates: &'static str,
    pub file: &'static str,
    pub open_repo: &'static str,
    pub clone_repo: &'static str,
    pub create_repo: &'static str,
    pub apply_patch: &'static str,
    pub close_repo: &'static str,
    pub edit: &'static str,
    pub view: &'static str,
    pub view_status: &'static str,
    pub view_history: &'static str,
    pub view_diff: &'static str,
    pub toggle_output: &'static str,
    pub shortcuts: &'static str,
    pub repository: &'static str,
    pub fetch: &'static str,
    pub pull: &'static str,
    pub push: &'static str,
    pub merge: &'static str,
    pub bisect: &'static str,
    pub refresh: &'static str,
    pub help: &'static str,
    pub documentation: &'static str,
}

const MENU_EN: MenuLabels = MenuLabels {
    app: "OpenGit",
    check_updates: "Check for Updates…",
    file: "File",
    open_repo: "Open Repository…",
    clone_repo: "Clone Repository…",
    create_repo: "Create Repository…",
    apply_patch: "Apply Patch…",
    close_repo: "Close Repository",
    edit: "Edit",
    view: "View",
    view_status: "File Status",
    view_history: "History",
    view_diff: "Diff",
    toggle_output: "Output",
    shortcuts: "Keyboard Shortcuts",
    repository: "Repository",
    fetch: "Fetch",
    pull: "Pull",
    push: "Push",
    merge: "Merge…",
    bisect: "Bisect…",
    refresh: "Refresh",
    help: "Help",
    documentation: "Documentation",
};

const MENU_ES: MenuLabels = MenuLabels {
    app: "OpenGit",
    check_updates: "Buscar actualizaciones…",
    file: "Archivo",
    open_repo: "Abrir repositorio…",
    clone_repo: "Clonar repositorio…",
    create_repo: "Crear repositorio…",
    apply_patch: "Aplicar parche…",
    close_repo: "Cerrar repositorio",
    edit: "Edición",
    view: "Ver",
    view_status: "Estado de archivos",
    view_history: "Historial",
    view_diff: "Diff",
    toggle_output: "Salida",
    shortcuts: "Atajos de teclado",
    repository: "Repositorio",
    fetch: "Fetch",
    pull: "Pull",
    push: "Push",
    merge: "Merge…",
    bisect: "Bisect…",
    refresh: "Actualizar",
    help: "Ayuda",
    documentation: "Documentación",
};

/// Menu labels for a locale; anything that is not Spanish falls back to English.
pub fn menu_labels(locale: &str) -> &'static MenuLabels {
    if locale.to_ascii_lowercase().starts_with("es") {
        &MENU_ES
    } else {
        &MENU_EN
    }
}

/// Builds the native menu. Clicks emit `menu-action` with the item id and the
/// UI routes them to the same handlers as the shortcuts. No accelerators
/// (except the Edit defaults) to avoid duplicating keyboard handling.
pub fn build_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
    labels: &MenuLabels,
) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(manager, labels.app)
        .about(Some(AboutMetadata::default()))
        .item(&MenuItemBuilder::with_id("check-updates", labels.check_updates).build(manager)?)
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(manager, labels.file)
        .item(&MenuItemBuilder::with_id("open-repo", labels.open_repo).build(manager)?)
        .item(&MenuItemBuilder::with_id("clone-repo", labels.clone_repo).build(manager)?)
        .item(&MenuItemBuilder::with_id("create-repo", labels.create_repo).build(manager)?)
        .item(&MenuItemBuilder::with_id("apply-patch", labels.apply_patch).build(manager)?)
        .item(&MenuItemBuilder::with_id("close-repo", labels.close_repo).build(manager)?)
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(manager, labels.edit)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(manager, labels.view)
        .item(&MenuItemBuilder::with_id("view-status", labels.view_status).build(manager)?)
        .item(&MenuItemBuilder::with_id("view-history", labels.view_history).build(manager)?)
        .item(&MenuItemBuilder::with_id("view-diff", labels.view_diff).build(manager)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-output", labels.toggle_output).build(manager)?)
        .item(&MenuItemBuilder::with_id("shortcuts", labels.shortcuts).build(manager)?)
        .build()?;

    let repository_menu = SubmenuBuilder::new(manager, labels.repository)
        .item(&MenuItemBuilder::with_id("fetch", labels.fetch).build(manager)?)
        .item(&MenuItemBuilder::with_id("pull", labels.pull).build(manager)?)
        .item(&MenuItemBuilder::with_id("push", labels.push).build(manager)?)
        .separator()
        .item(&MenuItemBuilder::with_id("merge", labels.merge).build(manager)?)
        .item(&MenuItemBuilder::with_id("bisect", labels.bisect).build(manager)?)
        .separator()
        .item(&MenuItemBuilder::with_id("refresh", labels.refresh).build(manager)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(manager, labels.help)
        .item(&MenuItemBuilder::with_id("documentation", labels.documentation).build(manager)?)
        .build()?;

    MenuBuilder::new(manager)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &repository_menu,
            &help_menu,
        ])
        .build()
}

/// Rebuilds the native menu for a locale. The listener registered at startup
/// keeps routing `menu-action` by item id.
#[tauri::command]
pub fn set_menu_locale(app: AppHandle, locale: String) -> Result<(), String> {
    let menu = build_menu(&app, menu_labels(&locale)).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spanish_locale_uses_the_spanish_labels() {
        let labels = menu_labels("es");
        assert_eq!(labels.file, "Archivo");
        assert_eq!(labels.open_repo, "Abrir repositorio…");
        assert_eq!(labels.repository, "Repositorio");
        // The brand stays the same in every locale.
        assert_eq!(labels.app, "OpenGit");
    }

    #[test]
    fn unknown_or_regional_locales_fall_back_to_english() {
        assert_eq!(menu_labels("fr").file, "File");
        assert_eq!(menu_labels("").file, "File");
        // A regional Spanish tag still selects Spanish.
        assert_eq!(menu_labels("es-MX").file, "Archivo");
    }

    #[test]
    fn english_labels_keep_the_original_menu_text() {
        let labels = menu_labels("en");
        assert_eq!(labels.check_updates, "Check for Updates…");
        assert_eq!(labels.view_status, "File Status");
        assert_eq!(labels.close_repo, "Close Repository");
    }
}
