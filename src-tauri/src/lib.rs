mod archive;

use archive::{
    create_entry, delete_asset, delete_entry, import_asset, import_entry_pdf, init_archive_root,
    load_archive, load_binary_asset, search_archive, update_entry, update_page,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            init_archive_root,
            load_archive,
            load_binary_asset,
            import_asset,
            import_entry_pdf,
            delete_asset,
            create_entry,
            update_entry,
            update_page,
            search_archive,
            delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
