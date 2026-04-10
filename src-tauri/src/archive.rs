use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use chrono::Utc;
use lopdf::Document;
use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zip::ZipArchive;

#[derive(Debug, Error)]
pub enum ArchiveError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
    #[error(transparent)]
    Pdf(#[from] lopdf::Error),
}

type ArchiveResult<T> = Result<T, ArchiveError>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntryRecord {
    pub id: String,
    pub title: String,
    pub entry_type: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub date_precision: Option<String>,
    pub description: Option<String>,
    pub language_or_system: Option<String>,
    pub tags_json: Option<String>,
    pub source_form: Option<String>,
    pub canonical_pdf_path: Option<String>,
    pub page_count: i64,
    pub status: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PageRecord {
    pub id: String,
    pub entry_id: String,
    pub page_number: Option<i64>,
    pub page_label: Option<String>,
    pub pdf_page_index: i64,
    pub transcription_text: Option<String>,
    pub summary: Option<String>,
    pub keywords_json: Option<String>,
    pub transcription_status: Option<String>,
    pub contains_special_glyphs: i64,
    pub special_glyph_note: Option<String>,
    pub legibility: Option<String>,
    pub page_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub id: String,
    pub entry_id: String,
    pub asset_type: String,
    pub file_path: String,
    pub label: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntryWithPages {
    pub entry: EntryRecord,
    pub pages: Vec<PageRecord>,
    pub assets: Vec<AssetRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchiveSnapshot {
    pub archive_root: String,
    pub entries: Vec<EntryWithPages>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEntryInput {
    pub title: String,
    pub entry_type: String,
    pub date_from: String,
    pub date_to: String,
    pub date_precision: String,
    pub description: String,
    pub language_or_system: String,
    pub tags: Vec<String>,
    pub source_form: String,
    pub status: String,
    pub notes: String,
    pub canonical_pdf_source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEntryResult {
    pub snapshot: ArchiveSnapshot,
    pub selected_entry_id: String,
    pub selected_page_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportAssetInput {
    pub entry_id: String,
    pub source_path: String,
    pub target_page_id: Option<String>,
    pub extraction_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportAssetResult {
    pub snapshot: ArchiveSnapshot,
    pub extraction_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub result_type: String,
    pub entry_id: String,
    pub page_id: Option<String>,
    pub entry_title: String,
    pub page_number: Option<i64>,
    pub label: String,
    pub snippet: String,
    pub matched_field: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BinaryAssetPayload {
    pub bytes: Vec<u8>,
}

fn to_tauri_error<E>(error: E) -> String
where
    E: Into<ArchiveError>,
{
    let archive_error: ArchiveError = error.into();
    archive_error.to_string()
}

fn normalize_root(root_path: &str) -> ArchiveResult<PathBuf> {
    let trimmed = root_path.trim();
    if trimmed.is_empty() {
        return Err(ArchiveError::Message("Archive root is required.".into()));
    }
    Ok(PathBuf::from(trimmed))
}

fn db_path(root: &Path) -> PathBuf {
    root.join("archive.db")
}

fn ensure_archive_structure(root: &Path) -> ArchiveResult<()> {
    fs::create_dir_all(root)?;
    for relative in [
        "assets",
        "assets/pdfs",
        "assets/images",
        "assets/resources",
        "thumbs",
        "exports",
        "trash",
        "config",
    ] {
        fs::create_dir_all(root.join(relative))?;
    }
    Ok(())
}

fn connection_for_root(root: &Path) -> ArchiveResult<Connection> {
    ensure_archive_structure(root)?;
    let connection = Connection::open(db_path(root))?;
    initialize_schema(&connection)?;
    Ok(connection)
}

fn initialize_schema(connection: &Connection) -> ArchiveResult<()> {
    connection.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          entry_type TEXT,
          date_from TEXT,
          date_to TEXT,
          date_precision TEXT,
          description TEXT,
          language_or_system TEXT,
          tags_json TEXT,
          source_form TEXT,
          canonical_pdf_path TEXT,
          page_count INTEGER DEFAULT 0,
          status TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          page_number INTEGER,
          page_label TEXT,
          pdf_page_index INTEGER NOT NULL,
          transcription_text TEXT,
          summary TEXT,
          keywords_json TEXT,
          transcription_status TEXT,
          contains_special_glyphs INTEGER DEFAULT 0,
          special_glyph_note TEXT,
          legibility TEXT,
          page_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          label TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_config (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS counters (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        );

        INSERT OR IGNORE INTO counters (key, value) VALUES ('entry', 0);
        INSERT OR IGNORE INTO counters (key, value) VALUES ('page', 0);
        INSERT OR IGNORE INTO counters (key, value) VALUES ('asset', 0);
        ",
    )?;
    Ok(())
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn next_id(transaction: &Transaction<'_>, key: &str, prefix: &str) -> ArchiveResult<String> {
    let current_value: i64 = transaction.query_row(
        "SELECT value FROM counters WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )?;
    let next_value = current_value + 1;
    transaction.execute(
        "UPDATE counters SET value = ?1 WHERE key = ?2",
        params![next_value, key],
    )?;
    Ok(format!("{prefix}{next_value:06}"))
}

fn relative_pdf_path(entry_id: &str) -> String {
    format!("assets/pdfs/{entry_id}.pdf")
}

fn relative_resource_path(asset_id: &str, extension: Option<&str>) -> String {
    match extension.filter(|value| !value.is_empty()) {
        Some(ext) => format!("assets/resources/{asset_id}.{ext}"),
        None => format!("assets/resources/{asset_id}"),
    }
}

fn absolute_asset_path(root: &Path, relative: &str) -> PathBuf {
    let mut path = root.to_path_buf();
    for part in relative.split('/') {
        path = path.join(part);
    }
    path
}

fn read_pdf_page_count(pdf_path: &Path) -> ArchiveResult<usize> {
    let document = Document::load(pdf_path)?;
    Ok(document.get_pages().len())
}

fn clean_optional(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn build_search_snippet(text: &str, query: &str) -> String {
    let single_line = text.replace('\n', " ");
    let _ = query;
    single_line.chars().take(120).collect()
}

fn unique_trash_destination(root: &Path, file_name: &str) -> PathBuf {
    let timestamp = Utc::now().format("%Y%m%d%H%M%S");
    root.join("trash").join(format!("{timestamp}_{file_name}"))
}

fn normalize_plain_text(value: &str) -> String {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines = Vec::new();
    let mut previous_blank = false;

    for line in normalized.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !previous_blank {
                lines.push(String::new());
                previous_blank = true;
            }
        } else {
            lines.push(trimmed.to_string());
            previous_blank = false;
        }
    }

    lines.join("\n").trim().to_string()
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn strip_markdown_to_plain_text(value: &str) -> String {
    let mut text = value.replace("\r\n", "\n").replace('\r', "\n");
    text = Regex::new(r"!\[([^\]]*)\]\([^)]+\)")
        .unwrap()
        .replace_all(&text, "$1")
        .into_owned();
    text = Regex::new(r"\[([^\]]+)\]\([^)]+\)")
        .unwrap()
        .replace_all(&text, "$1")
        .into_owned();
    text = Regex::new(r"(?m)^\s{0,3}#{1,6}\s*")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();
    text = Regex::new(r"(?m)^\s{0,3}>\s?")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();
    text = Regex::new(r"(?m)^\s*[-*+]\s+")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();
    text = Regex::new(r"(?m)^\s*\d+\.\s+")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();
    text = text
        .replace("```", "")
        .replace('`', "")
        .replace("**", "")
        .replace("__", "")
        .replace("~~", "")
        .replace('*', "")
        .replace('_', "");
    normalize_plain_text(&text)
}

fn extract_docx_plain_text(path: &Path) -> ArchiveResult<String> {
    let file = fs::File::open(path)?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| ArchiveError::Message(format!("ZIP open failed: {error}")))?;
    let mut document_xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|_| ArchiveError::Message("DOCX document.xml not found.".into()))?
        .read_to_string(&mut document_xml)
        .map_err(|error| ArchiveError::Message(format!("DOCX read failed: {error}")))?;

    let prepared = document_xml
        .replace("<w:tab/>", "\t")
        .replace("<w:tab />", "\t")
        .replace("<w:br/>", "\n")
        .replace("<w:br />", "\n")
        .replace("<w:cr/>", "\n")
        .replace("<w:cr />", "\n")
        .replace("</w:p>", "\n\n")
        .replace("</w:tr>", "\n");
    let without_tags = Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(&prepared, "")
        .into_owned();
    Ok(normalize_plain_text(&decode_xml_entities(&without_tags)))
}

fn extract_plain_text_from_path(path: &Path) -> ArchiveResult<Option<String>> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    match extension.as_deref() {
        Some("txt") => {
            let bytes = fs::read(path)?;
            Ok(Some(normalize_plain_text(&String::from_utf8_lossy(&bytes))))
        }
        Some("md") => {
            let bytes = fs::read(path)?;
            Ok(Some(strip_markdown_to_plain_text(&String::from_utf8_lossy(&bytes))))
        }
        Some("docx") => Ok(Some(extract_docx_plain_text(path)?)),
        _ => Ok(None),
    }
}

fn detect_asset_type(path: &Path) -> String {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    match extension.as_deref() {
        Some("md") => "md".into(),
        Some("docx") => "docx".into(),
        Some("txt") => "txt".into(),
        Some("pdf") => "pdf".into(),
        Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp") | Some("bmp") | Some("tif")
        | Some("tiff") => "image".into(),
        Some(other) => other.to_string(),
        None => "file".into(),
    }
}

fn load_snapshot_internal(root: &Path) -> ArchiveResult<ArchiveSnapshot> {
    let connection = connection_for_root(root)?;
    let mut entry_statement = connection.prepare(
        "
        SELECT
          id, title, entry_type, date_from, date_to, date_precision, description,
          language_or_system, tags_json, source_form, canonical_pdf_path, page_count,
          status, notes, created_at, updated_at
        FROM entries
        ORDER BY updated_at DESC, id DESC
        ",
    )?;

    let entry_rows = entry_statement.query_map([], |row| {
        Ok(EntryRecord {
            id: row.get(0)?,
            title: row.get(1)?,
            entry_type: row.get(2)?,
            date_from: row.get(3)?,
            date_to: row.get(4)?,
            date_precision: row.get(5)?,
            description: row.get(6)?,
            language_or_system: row.get(7)?,
            tags_json: row.get(8)?,
            source_form: row.get(9)?,
            canonical_pdf_path: row.get(10)?,
            page_count: row.get(11)?,
            status: row.get(12)?,
            notes: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;

    let entries: Vec<EntryRecord> = entry_rows.collect::<Result<_, _>>()?;
    let mut page_statement = connection.prepare(
        "
        SELECT
          id, entry_id, page_number, page_label, pdf_page_index, transcription_text,
          summary, keywords_json, transcription_status, contains_special_glyphs,
          special_glyph_note, legibility, page_notes, created_at, updated_at
        FROM pages
        WHERE entry_id = ?1
        ORDER BY pdf_page_index ASC, id ASC
        ",
    )?;
    let mut asset_statement = connection.prepare(
        "
        SELECT
          id, entry_id, asset_type, file_path, label, notes, created_at, updated_at
        FROM assets
        WHERE entry_id = ?1
        ORDER BY created_at ASC, id ASC
        ",
    )?;

    let mut bundles = Vec::with_capacity(entries.len());
    for entry in entries {
        let page_rows = page_statement.query_map(params![entry.id.as_str()], |row| {
            Ok(PageRecord {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                page_number: row.get(2)?,
                page_label: row.get(3)?,
                pdf_page_index: row.get(4)?,
                transcription_text: row.get(5)?,
                summary: row.get(6)?,
                keywords_json: row.get(7)?,
                transcription_status: row.get(8)?,
                contains_special_glyphs: row.get(9)?,
                special_glyph_note: row.get(10)?,
                legibility: row.get(11)?,
                page_notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?;
        let asset_rows = asset_statement.query_map(params![entry.id.as_str()], |row| {
            Ok(AssetRecord {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                asset_type: row.get(2)?,
                file_path: row.get(3)?,
                label: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        bundles.push(EntryWithPages {
            entry,
            pages: page_rows.collect::<Result<_, _>>()?,
            assets: asset_rows.collect::<Result<_, _>>()?,
        });
    }

    Ok(ArchiveSnapshot {
        archive_root: root.to_string_lossy().to_string(),
        entries: bundles,
    })
}

#[tauri::command]
pub fn init_archive_root(root_path: String) -> Result<ArchiveSnapshot, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    load_snapshot_internal(&root).map_err(to_tauri_error)
}

#[tauri::command]
pub fn load_archive(root_path: String) -> Result<ArchiveSnapshot, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    load_snapshot_internal(&root).map_err(to_tauri_error)
}

#[tauri::command]
pub fn load_binary_asset(root_path: String, relative_path: String) -> Result<BinaryAssetPayload, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let asset_path = absolute_asset_path(&root, &relative_path);
    let bytes = fs::read(asset_path).map_err(to_tauri_error)?;
    Ok(BinaryAssetPayload { bytes })
}

#[tauri::command]
pub fn import_asset(root_path: String, input: ImportAssetInput) -> Result<ImportAssetResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let source = PathBuf::from(input.source_path.trim());
    if !source.exists() {
        return Err("The selected resource file does not exist.".into());
    }

    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;
    let asset_id = next_id(&transaction, "asset", "A").map_err(to_tauri_error)?;
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let relative_path = relative_resource_path(&asset_id, extension.as_deref());
    let destination = absolute_asset_path(&root, &relative_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_tauri_error)?;
    }
    fs::copy(&source, &destination).map_err(to_tauri_error)?;

    let now = now_iso();
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());
    transaction
        .execute(
            "
            INSERT INTO assets (
              id, entry_id, asset_type, file_path, label, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)
            ",
            params![
                asset_id.as_str(),
                input.entry_id.as_str(),
                detect_asset_type(&source),
                relative_path.as_str(),
                file_name,
                now.as_str(),
                now.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    let mut extraction_status = "none".to_string();
    if input.extraction_mode != "none" {
        match extract_plain_text_from_path(&source).map_err(to_tauri_error)? {
            Some(extracted) if !extracted.trim().is_empty() => {
                if let Some(target_page_id) = input.target_page_id.as_deref() {
                    let existing_text: Option<String> = transaction
                        .query_row(
                            "SELECT transcription_text FROM pages WHERE id = ?1",
                            params![target_page_id],
                            |row| row.get(0),
                        )
                        .optional()
                        .map_err(to_tauri_error)?
                        .flatten();

                    let next_transcription = if input.extraction_mode == "append" {
                        match existing_text {
                            Some(existing) if !existing.trim().is_empty() => {
                                format!("{}\n\n{}", existing.trim_end(), extracted.trim())
                            }
                            _ => extracted,
                        }
                    } else {
                        extracted
                    };

                    transaction
                        .execute(
                            "
                            UPDATE pages
                            SET transcription_text = ?2, updated_at = ?3
                            WHERE id = ?1
                            ",
                            params![target_page_id, next_transcription, now.as_str()],
                        )
                        .map_err(to_tauri_error)?;
                    extraction_status = "success".into();
                } else {
                    extraction_status = "failed".into();
                }
            }
            Some(_) => {
                extraction_status = "failed".into();
            }
            None => {
                extraction_status = "unsupported".into();
            }
        }
    }

    transaction
        .execute(
            "UPDATE entries SET updated_at = ?2 WHERE id = ?1",
            params![input.entry_id.as_str(), now.as_str()],
        )
        .map_err(to_tauri_error)?;

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(ImportAssetResult {
        snapshot,
        extraction_status,
    })
}

#[tauri::command]
pub fn delete_asset(root_path: String, asset_id: String) -> Result<ArchiveSnapshot, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;

    let asset_row: Option<(String, String)> = connection
        .query_row(
            "SELECT entry_id, file_path FROM assets WHERE id = ?1",
            params![asset_id.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(to_tauri_error)?;

    let Some((entry_id, relative_path)) = asset_row else {
        return load_snapshot_internal(&root).map_err(to_tauri_error);
    };

    let source = absolute_asset_path(&root, &relative_path);
    if source.exists() {
        let file_name = source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("asset.bin");
        let destination = unique_trash_destination(&root, file_name);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(to_tauri_error)?;
        }
        fs::rename(source, destination).map_err(to_tauri_error)?;
    }

    let now = now_iso();
    connection
        .execute("DELETE FROM assets WHERE id = ?1", params![asset_id.as_str()])
        .map_err(to_tauri_error)?;
    connection
        .execute(
            "UPDATE entries SET updated_at = ?2 WHERE id = ?1",
            params![entry_id.as_str(), now.as_str()],
        )
        .map_err(to_tauri_error)?;

    load_snapshot_internal(&root).map_err(to_tauri_error)
}

#[tauri::command]
pub fn create_entry(root_path: String, input: CreateEntryInput) -> Result<CreateEntryResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let source_path = PathBuf::from(input.canonical_pdf_source.trim());
    if !source_path.exists() {
        return Err("The selected PDF file does not exist.".into());
    }

    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;
    let entry_id = next_id(&transaction, "entry", "E").map_err(to_tauri_error)?;
    let page_count = read_pdf_page_count(&source_path).map_err(to_tauri_error)? as i64;
    let relative_pdf = relative_pdf_path(&entry_id);
    let destination_path = absolute_asset_path(&root, &relative_pdf);
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(to_tauri_error)?;
    }
    fs::copy(&source_path, &destination_path).map_err(to_tauri_error)?;

    let now = now_iso();
    let tags_json = serde_json::to_string(&input.tags).map_err(|error| error.to_string())?;
    transaction
        .execute(
            "
            INSERT INTO entries (
              id, title, entry_type, date_from, date_to, date_precision, description,
              language_or_system, tags_json, source_form, canonical_pdf_path, page_count,
              status, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            ",
            params![
                entry_id.as_str(),
                input.title.trim(),
                clean_optional(&input.entry_type),
                clean_optional(&input.date_from),
                clean_optional(&input.date_to),
                clean_optional(&input.date_precision),
                clean_optional(&input.description),
                clean_optional(&input.language_or_system),
                tags_json,
                clean_optional(&input.source_form),
                relative_pdf.as_str(),
                page_count,
                clean_optional(&input.status),
                clean_optional(&input.notes),
                now.as_str(),
                now.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    let mut first_page_id: Option<String> = None;
    for pdf_page_index in 0..page_count {
        let page_id = next_id(&transaction, "page", "P").map_err(to_tauri_error)?;
        if first_page_id.is_none() {
            first_page_id = Some(page_id.clone());
        }
        transaction
            .execute(
                "
                INSERT INTO pages (
                  id, entry_id, page_number, page_label, pdf_page_index, transcription_text,
                  summary, keywords_json, transcription_status, contains_special_glyphs,
                  special_glyph_note, legibility, page_notes, created_at, updated_at
                ) VALUES (?1, ?2, ?3, NULL, ?4, NULL, NULL, '[]', 'none', 0, NULL, 'clear', NULL, ?5, ?6)
                ",
                params![
                    page_id.as_str(),
                    entry_id.as_str(),
                    pdf_page_index + 1,
                    pdf_page_index,
                    now.as_str(),
                    now.as_str()
                ],
            )
            .map_err(to_tauri_error)?;
    }

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(CreateEntryResult {
        snapshot,
        selected_entry_id: entry_id,
        selected_page_id: first_page_id,
    })
}

#[tauri::command]
pub fn update_entry(root_path: String, entry: EntryRecord) -> Result<EntryRecord, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let updated_at = now_iso();
    connection
        .execute(
            "
            UPDATE entries SET
              title = ?2,
              entry_type = ?3,
              date_from = ?4,
              date_to = ?5,
              date_precision = ?6,
              description = ?7,
              language_or_system = ?8,
              tags_json = ?9,
              source_form = ?10,
              status = ?11,
              notes = ?12,
              updated_at = ?13
            WHERE id = ?1
            ",
            params![
                entry.id.as_str(),
                entry.title.trim(),
                entry.entry_type.as_deref(),
                entry.date_from.as_deref(),
                entry.date_to.as_deref(),
                entry.date_precision.as_deref(),
                entry.description.as_deref(),
                entry.language_or_system.as_deref(),
                entry.tags_json.as_deref(),
                entry.source_form.as_deref(),
                entry.status.as_deref(),
                entry.notes.as_deref(),
                updated_at.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    connection
        .query_row(
            "
            SELECT
              id, title, entry_type, date_from, date_to, date_precision, description,
              language_or_system, tags_json, source_form, canonical_pdf_path, page_count,
              status, notes, created_at, updated_at
            FROM entries
            WHERE id = ?1
            ",
            params![entry.id.as_str()],
            |row| {
                Ok(EntryRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    entry_type: row.get(2)?,
                    date_from: row.get(3)?,
                    date_to: row.get(4)?,
                    date_precision: row.get(5)?,
                    description: row.get(6)?,
                    language_or_system: row.get(7)?,
                    tags_json: row.get(8)?,
                    source_form: row.get(9)?,
                    canonical_pdf_path: row.get(10)?,
                    page_count: row.get(11)?,
                    status: row.get(12)?,
                    notes: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            },
        )
        .map_err(to_tauri_error)
}

#[tauri::command]
pub fn update_page(root_path: String, page: PageRecord) -> Result<PageRecord, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let updated_at = now_iso();

    connection
        .execute(
            "
            UPDATE pages SET
              page_number = ?2,
              page_label = ?3,
              transcription_text = ?4,
              summary = ?5,
              keywords_json = ?6,
              transcription_status = ?7,
              contains_special_glyphs = ?8,
              special_glyph_note = ?9,
              legibility = ?10,
              page_notes = ?11,
              updated_at = ?12
            WHERE id = ?1
            ",
            params![
                page.id.as_str(),
                page.page_number,
                page.page_label.as_deref(),
                page.transcription_text.as_deref(),
                page.summary.as_deref(),
                page.keywords_json.as_deref(),
                page.transcription_status.as_deref(),
                page.contains_special_glyphs,
                page.special_glyph_note.as_deref(),
                page.legibility.as_deref(),
                page.page_notes.as_deref(),
                updated_at.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    connection
        .execute(
            "UPDATE entries SET updated_at = ?2 WHERE id = ?1",
            params![page.entry_id.as_str(), updated_at.as_str()],
        )
        .map_err(to_tauri_error)?;

    connection
        .query_row(
            "
            SELECT
              id, entry_id, page_number, page_label, pdf_page_index, transcription_text,
              summary, keywords_json, transcription_status, contains_special_glyphs,
              special_glyph_note, legibility, page_notes, created_at, updated_at
            FROM pages
            WHERE id = ?1
            ",
            params![page.id.as_str()],
            |row| {
                Ok(PageRecord {
                    id: row.get(0)?,
                    entry_id: row.get(1)?,
                    page_number: row.get(2)?,
                    page_label: row.get(3)?,
                    pdf_page_index: row.get(4)?,
                    transcription_text: row.get(5)?,
                    summary: row.get(6)?,
                    keywords_json: row.get(7)?,
                    transcription_status: row.get(8)?,
                    contains_special_glyphs: row.get(9)?,
                    special_glyph_note: row.get(10)?,
                    legibility: row.get(11)?,
                    page_notes: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .map_err(to_tauri_error)
}

#[tauri::command]
pub fn search_archive(root_path: String, mode: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }

    let like_query = format!("%{}%", trimmed_query.to_lowercase());
    let sql = if mode == "full_text" {
        "
        SELECT
          'page' AS result_type,
          e.id,
          p.id,
          e.title,
          p.page_number,
          COALESCE(p.transcription_text, p.summary, p.page_notes, p.special_glyph_note, ''),
          CASE
            WHEN LOWER(COALESCE(p.transcription_text, '')) LIKE ?1 THEN 'transcription_text'
            WHEN LOWER(COALESCE(p.summary, '')) LIKE ?1 THEN 'summary'
            WHEN LOWER(COALESCE(p.page_notes, '')) LIKE ?1 THEN 'page_notes'
            ELSE 'special_glyph_note'
          END
        FROM pages p
        JOIN entries e ON e.id = p.entry_id
        WHERE
          LOWER(COALESCE(p.transcription_text, '')) LIKE ?1 OR
          LOWER(COALESCE(p.summary, '')) LIKE ?1 OR
          LOWER(COALESCE(p.page_notes, '')) LIKE ?1 OR
          LOWER(COALESCE(p.special_glyph_note, '')) LIKE ?1
        ORDER BY e.updated_at DESC, p.pdf_page_index ASC
        LIMIT 200
        "
    } else {
        "
        SELECT
          CASE
            WHEN LOWER(COALESCE(p.summary, '')) LIKE ?1 OR LOWER(COALESCE(p.page_notes, '')) LIKE ?1 OR LOWER(COALESCE(p.keywords_json, '')) LIKE ?1
            THEN 'page'
            ELSE 'entry'
          END AS result_type,
          e.id,
          p.id,
          e.title,
          p.page_number,
          COALESCE(
            p.summary,
            p.page_notes,
            e.description,
            e.tags_json,
            e.language_or_system,
            e.entry_type,
            e.title,
            ''
          ),
          CASE
            WHEN LOWER(COALESCE(e.title, '')) LIKE ?1 THEN 'title'
            WHEN LOWER(COALESCE(e.description, '')) LIKE ?1 THEN 'description'
            WHEN LOWER(COALESCE(e.entry_type, '')) LIKE ?1 THEN 'entry_type'
            WHEN LOWER(COALESCE(e.tags_json, '')) LIKE ?1 THEN 'tags_json'
            WHEN LOWER(COALESCE(e.language_or_system, '')) LIKE ?1 THEN 'language_or_system'
            WHEN LOWER(COALESCE(p.summary, '')) LIKE ?1 THEN 'summary'
            WHEN LOWER(COALESCE(p.keywords_json, '')) LIKE ?1 THEN 'keywords_json'
            ELSE 'page_notes'
          END
        FROM entries e
        LEFT JOIN pages p ON p.entry_id = e.id
        WHERE
          LOWER(COALESCE(e.title, '')) LIKE ?1 OR
          LOWER(COALESCE(e.description, '')) LIKE ?1 OR
          LOWER(COALESCE(e.entry_type, '')) LIKE ?1 OR
          LOWER(COALESCE(e.tags_json, '')) LIKE ?1 OR
          LOWER(COALESCE(e.language_or_system, '')) LIKE ?1 OR
          LOWER(COALESCE(p.summary, '')) LIKE ?1 OR
          LOWER(COALESCE(p.keywords_json, '')) LIKE ?1 OR
          LOWER(COALESCE(p.page_notes, '')) LIKE ?1
        ORDER BY e.updated_at DESC
        LIMIT 200
        "
    };

    let mut statement = connection.prepare(sql).map_err(to_tauri_error)?;
    let rows = statement
        .query_map(params![like_query], |row| {
            let result_type: String = row.get(0)?;
            let entry_id: String = row.get(1)?;
            let page_id: Option<String> = row.get(2)?;
            let entry_title: String = row.get(3)?;
            let page_number: Option<i64> = row.get(4)?;
            let source_text: String = row.get(5)?;
            let matched_field: String = row.get(6)?;
            let label = if result_type == "page" {
                match page_number {
                    Some(number) => format!("{entry_title} - Page {number}"),
                    None => format!("{entry_title} - Page"),
                }
            } else {
                entry_title.clone()
            };

            Ok(SearchResult {
                result_type,
                entry_id,
                page_id,
                entry_title,
                page_number,
                label,
                snippet: build_search_snippet(&source_text, trimmed_query),
                matched_field,
            })
        })
        .map_err(to_tauri_error)?;

    rows.collect::<Result<Vec<_>, _>>().map_err(to_tauri_error)
}

#[tauri::command]
pub fn delete_entry(root_path: String, entry_id: String) -> Result<ArchiveSnapshot, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let canonical_pdf_path: Option<String> = connection
        .query_row(
            "SELECT canonical_pdf_path FROM entries WHERE id = ?1",
            params![entry_id.as_str()],
            |row| row.get(0),
        )
        .optional()
        .map_err(to_tauri_error)?
        .flatten();

    if let Some(relative_path) = canonical_pdf_path {
        let source = absolute_asset_path(&root, &relative_path);
        if source.exists() {
            let file_name = source
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("archived.pdf");
            let destination = unique_trash_destination(&root, file_name);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(to_tauri_error)?;
            }
            fs::rename(source, destination).map_err(to_tauri_error)?;
        }
    }

    let mut asset_statement = connection
        .prepare("SELECT file_path FROM assets WHERE entry_id = ?1")
        .map_err(to_tauri_error)?;
    let asset_paths = asset_statement
        .query_map(params![entry_id.as_str()], |row| row.get::<_, String>(0))
        .map_err(to_tauri_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_tauri_error)?;

    for relative_path in asset_paths {
        let source = absolute_asset_path(&root, &relative_path);
        if !source.exists() {
            continue;
        }

        let file_name = source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("asset.bin");
        let destination = unique_trash_destination(&root, file_name);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(to_tauri_error)?;
        }
        fs::rename(source, destination).map_err(to_tauri_error)?;
    }

    connection
        .execute("DELETE FROM entries WHERE id = ?1", params![entry_id])
        .map_err(to_tauri_error)?;

    load_snapshot_internal(&root).map_err(to_tauri_error)
}
