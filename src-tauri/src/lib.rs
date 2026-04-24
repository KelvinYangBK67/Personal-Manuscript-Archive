mod archive;

use archive::{
    batch_import_files, copy_page, create_entry, delete_asset, delete_entry, import_asset, import_entry_pdf,
    init_archive_root, load_archive, load_binary_asset, move_page, remove_page, search_archive,
    update_entry, update_page,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            init_archive_root,
            load_archive,
            load_binary_asset,
            batch_import_files,
            import_asset,
            import_entry_pdf,
            delete_asset,
            create_entry,
            move_page,
            copy_page,
            remove_page,
            update_entry,
            update_page,
            search_archive,
            delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
