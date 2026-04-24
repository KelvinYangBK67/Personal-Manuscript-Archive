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
    pub date_year: Option<i64>,
    pub date_month: Option<i64>,
    pub date_day: Option<i64>,
    pub date_year_uncertain: i64,
    pub date_month_uncertain: i64,
    pub date_day_uncertain: i64,
    pub date_note: Option<String>,
    pub description: Option<String>,
    pub tags_json: Option<String>,
    pub page_count: i64,
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
    pub sort_order: i64,
    pub source_asset_id: Option<String>,
    pub source_pdf_path: Option<String>,
    pub source_pdf_page_index: i64,
    pub original_page_number: Option<i64>,
    pub transcription_text: Option<String>,
    pub summary: Option<String>,
    pub keywords_json: Option<String>,
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
    pub date_year: Option<i64>,
    pub date_month: Option<i64>,
    pub date_day: Option<i64>,
    pub date_year_uncertain: i64,
    pub date_month_uncertain: i64,
    pub date_day_uncertain: i64,
    pub date_note: String,
    pub description: String,
    pub tags: Vec<String>,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportEntryPdfInput {
    pub entry_id: String,
    pub source_path: String,
    pub page_start: Option<i64>,
    pub page_end: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchImportInput {
    pub source_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchImportItemResult {
    pub source_path: String,
    pub entry_id: Option<String>,
    pub selected_page_id: Option<String>,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchImportResult {
    pub snapshot: ArchiveSnapshot,
    pub imported_count: i64,
    pub failed_count: i64,
    pub results: Vec<BatchImportItemResult>,
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
pub struct PageMutationInput {
    pub page_id: String,
    pub target_entry_id: String,
    pub target_before_page_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemovePageInput {
    pub page_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageMutationResult {
    pub snapshot: ArchiveSnapshot,
    pub selected_entry_id: Option<String>,
    pub selected_page_id: Option<String>,
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
    pub snippet_parts: Vec<SnippetPart>,
    pub highlight_terms: Vec<String>,
    pub match_count: i64,
    pub query_summary: Option<String>,
    pub matched_field: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SnippetPart {
    pub text: String,
    pub highlighted: bool,
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

fn column_exists(connection: &Connection, table: &str, column: &str) -> ArchiveResult<bool> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = statement.query_map([], |row| row.get::<_, String>(1))?;
    for column_name in rows {
        if column_name? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn initialize_schema(connection: &Connection) -> ArchiveResult<()> {
    connection.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          entry_type TEXT,
          date_year INTEGER,
          date_month INTEGER,
          date_day INTEGER,
          date_year_uncertain INTEGER DEFAULT 0,
          date_month_uncertain INTEGER DEFAULT 0,
          date_day_uncertain INTEGER DEFAULT 0,
          date_note TEXT,
          description TEXT,
          language_or_system TEXT,
          tags_json TEXT,
          page_count INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          page_number INTEGER,
          page_label TEXT,
          sort_order INTEGER DEFAULT 0,
          source_asset_id TEXT,
          source_pdf_path TEXT,
          source_pdf_page_index INTEGER NOT NULL DEFAULT 0,
          original_page_number INTEGER,
          transcription_text TEXT,
          summary TEXT,
          keywords_json TEXT,
          special_glyph_note TEXT,
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
    let _ = connection.execute("ALTER TABLE entries ADD COLUMN date_year INTEGER", []);
    let _ = connection.execute("ALTER TABLE entries ADD COLUMN date_month INTEGER", []);
    let _ = connection.execute("ALTER TABLE entries ADD COLUMN date_day INTEGER", []);
    let _ = connection.execute(
        "ALTER TABLE entries ADD COLUMN date_year_uncertain INTEGER DEFAULT 0",
        [],
    );
    let _ = connection.execute(
        "ALTER TABLE entries ADD COLUMN date_month_uncertain INTEGER DEFAULT 0",
        [],
    );
    let _ = connection.execute(
        "ALTER TABLE entries ADD COLUMN date_day_uncertain INTEGER DEFAULT 0",
        [],
    );
    let _ = connection.execute("ALTER TABLE entries ADD COLUMN date_note TEXT", []);

    let _ = connection.execute("ALTER TABLE pages ADD COLUMN sort_order INTEGER DEFAULT 0", []);
    let _ = connection.execute("ALTER TABLE pages ADD COLUMN source_asset_id TEXT", []);
    let _ = connection.execute("ALTER TABLE pages ADD COLUMN source_pdf_path TEXT", []);
    let _ = connection.execute(
        "ALTER TABLE pages ADD COLUMN source_pdf_page_index INTEGER DEFAULT 0",
        [],
    );
    let _ = connection.execute("ALTER TABLE pages ADD COLUMN original_page_number INTEGER", []);
    let _ = connection.execute("ALTER TABLE pages ADD COLUMN special_glyph_note TEXT", []);
    let has_legacy_pdf_page_index = column_exists(connection, "pages", "pdf_page_index")?;
    let has_legacy_canonical_pdf_path = column_exists(connection, "entries", "canonical_pdf_path")?;
    if has_legacy_pdf_page_index && has_legacy_canonical_pdf_path {
        let _ = connection.execute(
            "
            UPDATE pages
            SET
              sort_order = COALESCE(NULLIF(sort_order, 0), page_number, pdf_page_index + 1, 1),
              source_pdf_path = COALESCE(source_pdf_path, (
                SELECT canonical_pdf_path FROM entries WHERE entries.id = pages.entry_id
              )),
              source_pdf_page_index = COALESCE(source_pdf_page_index, pdf_page_index, 0),
              original_page_number = COALESCE(original_page_number, page_number)
            ",
            [],
        );
    } else {
        let _ = connection.execute(
            "
            UPDATE pages
            SET
              sort_order = COALESCE(NULLIF(sort_order, 0), page_number, 1),
              source_pdf_page_index = COALESCE(source_pdf_page_index, 0),
              original_page_number = COALESCE(original_page_number, page_number)
            ",
            [],
        );
    }
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

fn relative_source_pdf_path(asset_id: &str) -> String {
    format!("assets/pdfs/{asset_id}.pdf")
}

fn relative_resource_path(asset_id: &str, extension: Option<&str>) -> String {
    match extension.filter(|value| !value.is_empty()) {
        Some(ext) => format!("assets/resources/{asset_id}.{ext}"),
        None => format!("assets/resources/{asset_id}"),
    }
}

fn entry_exists(transaction: &Transaction<'_>, entry_id: &str) -> ArchiveResult<bool> {
    transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM entries WHERE id = ?1)",
            params![entry_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(ArchiveError::from)
}

fn load_page_ids_for_entry(transaction: &Transaction<'_>, entry_id: &str) -> ArchiveResult<Vec<String>> {
    let mut statement = transaction.prepare(
        "
        SELECT id
        FROM pages
        WHERE entry_id = ?1
        ORDER BY sort_order ASC, id ASC
        ",
    )?;

    let rows = statement.query_map(params![entry_id], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(ArchiveError::from)
}

fn apply_page_order(transaction: &Transaction<'_>, entry_id: &str, page_ids: &[String], now: &str) -> ArchiveResult<()> {
    for (index, page_id) in page_ids.iter().enumerate() {
        transaction.execute(
            "
            UPDATE pages
            SET entry_id = ?2, sort_order = ?3, updated_at = ?4
            WHERE id = ?1
            ",
            params![page_id.as_str(), entry_id, index as i64 + 1, now],
        )?;
    }

    transaction.execute(
        "
        UPDATE entries
        SET page_count = ?2, updated_at = ?3
        WHERE id = ?1
        ",
        params![entry_id, page_ids.len() as i64, now],
    )?;

    Ok(())
}

fn resolve_insert_index(page_ids: &[String], target_before_page_id: Option<&str>) -> usize {
    target_before_page_id
        .and_then(|before_id| page_ids.iter().position(|id| id == before_id))
        .unwrap_or(page_ids.len())
}

struct NewPageRow<'a> {
    id: &'a str,
    entry_id: &'a str,
    page_number: i64,
    sort_order: i64,
    source_asset_id: Option<&'a str>,
    source_pdf_path: Option<&'a str>,
    source_pdf_page_index: i64,
    original_page_number: Option<i64>,
    transcription_text: Option<&'a str>,
    summary: Option<&'a str>,
    keywords_json: Option<&'a str>,
    page_notes: Option<&'a str>,
    created_at: &'a str,
    updated_at: &'a str,
}

fn insert_page_row(
    transaction: &Transaction<'_>,
    include_legacy_pdf_page_index: bool,
    row: &NewPageRow<'_>,
) -> ArchiveResult<()> {
    if include_legacy_pdf_page_index {
        transaction.execute(
            "
            INSERT INTO pages (
              id, entry_id, page_number, page_label, sort_order, source_asset_id,
              source_pdf_path, source_pdf_page_index, pdf_page_index, original_page_number,
              transcription_text, summary, keywords_json, page_notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ",
            params![
                row.id,
                row.entry_id,
                row.page_number,
                row.sort_order,
                row.source_asset_id,
                row.source_pdf_path,
                row.source_pdf_page_index,
                row.source_pdf_page_index,
                row.original_page_number,
                row.transcription_text,
                row.summary,
                row.keywords_json,
                row.page_notes,
                row.created_at,
                row.updated_at
            ],
        )?;
    } else {
        transaction.execute(
            "
            INSERT INTO pages (
              id, entry_id, page_number, page_label, sort_order, source_asset_id,
              source_pdf_path, source_pdf_page_index, original_page_number,
              transcription_text, summary, keywords_json, page_notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ",
            params![
                row.id,
                row.entry_id,
                row.page_number,
                row.sort_order,
                row.source_asset_id,
                row.source_pdf_path,
                row.source_pdf_page_index,
                row.original_page_number,
                row.transcription_text,
                row.summary,
                row.keywords_json,
                row.page_notes,
                row.created_at,
                row.updated_at
            ],
        )?;
    }

    Ok(())
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

#[derive(Debug, Clone, PartialEq)]
enum SearchToken {
    Term(String),
    Op(SearchOperator),
    LParen,
    RParen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SearchOperator {
    And,
    Or,
    Not,
    Nand,
    Nor,
    Xor,
}

#[derive(Debug, Clone, PartialEq)]
enum SearchExpr {
    Term(String),
    Not(Box<SearchExpr>),
    And(Box<SearchExpr>, Box<SearchExpr>),
    Or(Box<SearchExpr>, Box<SearchExpr>),
    Nand(Box<SearchExpr>, Box<SearchExpr>),
    Nor(Box<SearchExpr>, Box<SearchExpr>),
    Xor(Box<SearchExpr>, Box<SearchExpr>),
}

#[derive(Debug, Clone)]
struct QueryEvaluation {
    matched: bool,
    positive_terms: Vec<String>,
}

#[derive(Debug, Clone)]
struct SearchCandidate {
    result_type: String,
    entry_id: String,
    page_id: Option<String>,
    entry_title: String,
    page_number: Option<i64>,
    source_text: String,
    matched_field: String,
}

fn classify_operator(value: &str) -> Option<SearchOperator> {
    match value.to_ascii_uppercase().as_str() {
        "AND" => Some(SearchOperator::And),
        "OR" => Some(SearchOperator::Or),
        "NOT" => Some(SearchOperator::Not),
        "NAND" => Some(SearchOperator::Nand),
        "NOR" => Some(SearchOperator::Nor),
        "XOR" => Some(SearchOperator::Xor),
        _ => None,
    }
}

fn tokenize_search_query(query: &str) -> Result<Vec<SearchToken>, String> {
    let chars: Vec<char> = query.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < chars.len() {
        if chars[index].is_whitespace() {
            index += 1;
            continue;
        }

        if chars[index] == '"' {
            index += 1;
            let mut value = String::new();
            let mut closed = false;
            while index < chars.len() {
                if chars[index] == '"' {
                    closed = true;
                    index += 1;
                    break;
                }
                value.push(chars[index]);
                index += 1;
            }
            if !closed {
                return Err("Invalid search query: unclosed quote".into());
            }
            if value.trim().is_empty() {
                return Err("Invalid search query: empty quoted phrase".into());
            }
            tokens.push(SearchToken::Term(value));
            continue;
        }

        if chars[index] == '(' {
            tokens.push(SearchToken::LParen);
            index += 1;
            continue;
        }

        if chars[index] == ')' {
            tokens.push(SearchToken::RParen);
            index += 1;
            continue;
        }

        let start = index;
        while index < chars.len() && !chars[index].is_whitespace() && chars[index] != '(' && chars[index] != ')' {
            index += 1;
        }
        let value: String = chars[start..index].iter().collect();
        if let Some(operator) = classify_operator(&value) {
            tokens.push(SearchToken::Op(operator));
        } else {
            tokens.push(SearchToken::Term(value));
        }
    }

    if tokens.is_empty() {
        return Err("Invalid search query: empty query".into());
    }

    Ok(tokens)
}

struct SearchParser {
    tokens: Vec<SearchToken>,
    index: usize,
}

impl SearchParser {
    fn new(tokens: Vec<SearchToken>) -> Self {
        Self { tokens, index: 0 }
    }

    fn parse(mut self) -> Result<SearchExpr, String> {
        let expression = self.parse_or_nor()?;
        if self.index < self.tokens.len() {
            return Err(format!("Invalid search query: unexpected token {:?}", self.tokens[self.index]));
        }
        Ok(expression)
    }

    fn peek(&self) -> Option<&SearchToken> {
        self.tokens.get(self.index)
    }

    fn consume_operator(&mut self, expected: &[SearchOperator]) -> Option<SearchOperator> {
        let Some(SearchToken::Op(operator)) = self.peek() else {
            return None;
        };
        if expected.contains(operator) {
            let consumed = *operator;
            self.index += 1;
            Some(consumed)
        } else {
            None
        }
    }

    fn parse_or_nor(&mut self) -> Result<SearchExpr, String> {
        let mut expression = self.parse_xor()?;
        while let Some(operator) = self.consume_operator(&[SearchOperator::Or, SearchOperator::Nor]) {
            let right = self.parse_xor().map_err(|_| "Invalid search query: dangling operator".to_string())?;
            expression = match operator {
                SearchOperator::Or => SearchExpr::Or(Box::new(expression), Box::new(right)),
                SearchOperator::Nor => SearchExpr::Nor(Box::new(expression), Box::new(right)),
                _ => unreachable!(),
            };
        }
        Ok(expression)
    }

    fn parse_xor(&mut self) -> Result<SearchExpr, String> {
        let mut expression = self.parse_and_nand()?;
        while self.consume_operator(&[SearchOperator::Xor]).is_some() {
            let right = self.parse_and_nand().map_err(|_| "Invalid search query: dangling operator".to_string())?;
            expression = SearchExpr::Xor(Box::new(expression), Box::new(right));
        }
        Ok(expression)
    }

    fn parse_and_nand(&mut self) -> Result<SearchExpr, String> {
        let mut expression = self.parse_not()?;
        while let Some(operator) = self.consume_operator(&[SearchOperator::And, SearchOperator::Nand]) {
            let right = self.parse_not().map_err(|_| "Invalid search query: dangling operator".to_string())?;
            expression = match operator {
                SearchOperator::And => SearchExpr::And(Box::new(expression), Box::new(right)),
                SearchOperator::Nand => SearchExpr::Nand(Box::new(expression), Box::new(right)),
                _ => unreachable!(),
            };
        }
        Ok(expression)
    }

    fn parse_not(&mut self) -> Result<SearchExpr, String> {
        if self.consume_operator(&[SearchOperator::Not]).is_some() {
            if matches!(self.peek(), None | Some(SearchToken::Op(_)) | Some(SearchToken::RParen)) {
                return Err("Invalid search query: unexpected token after NOT".into());
            }
            return Ok(SearchExpr::Not(Box::new(self.parse_not()?)));
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<SearchExpr, String> {
        match self.peek().cloned() {
            Some(SearchToken::Term(value)) => {
                self.index += 1;
                if matches!(self.peek(), Some(SearchToken::Term(_)) | Some(SearchToken::LParen)) {
                    return Err("Invalid search query: missing operator between terms".into());
                }
                Ok(SearchExpr::Term(value))
            }
            Some(SearchToken::LParen) => {
                self.index += 1;
                let expression = self.parse_or_nor()?;
                match self.peek() {
                    Some(SearchToken::RParen) => {
                        self.index += 1;
                        Ok(expression)
                    }
                    _ => Err("Invalid search query: unclosed parenthesis".into()),
                }
            }
            Some(SearchToken::Op(_)) => Err("Invalid search query: dangling operator".into()),
            Some(SearchToken::RParen) => Err("Invalid search query: unexpected closing parenthesis".into()),
            None => Err("Invalid search query: dangling operator".into()),
        }
    }
}

fn parse_search_query(query: &str) -> Result<SearchExpr, String> {
    SearchParser::new(tokenize_search_query(query)?).parse()
}

fn text_contains_case_insensitive(text: &str, term: &str) -> bool {
    text.to_lowercase().contains(&term.to_lowercase())
}

fn merge_terms(mut terms: Vec<String>) -> Vec<String> {
    terms.retain(|term| !term.trim().is_empty());
    terms.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()).then_with(|| b.len().cmp(&a.len())));
    terms.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    terms
}

fn evaluate_search_expr(expression: &SearchExpr, text: &str) -> QueryEvaluation {
    match expression {
        SearchExpr::Term(value) => {
            let matched = text_contains_case_insensitive(text, value);
            QueryEvaluation {
                matched,
                positive_terms: if matched { vec![value.clone()] } else { Vec::new() },
            }
        }
        SearchExpr::Not(inner) => {
            let evaluation = evaluate_search_expr(inner, text);
            QueryEvaluation {
                matched: !evaluation.matched,
                positive_terms: Vec::new(),
            }
        }
        SearchExpr::And(left, right) => {
            let left = evaluate_search_expr(left, text);
            let right = evaluate_search_expr(right, text);
            QueryEvaluation {
                matched: left.matched && right.matched,
                positive_terms: if left.matched && right.matched {
                    merge_terms([left.positive_terms, right.positive_terms].concat())
                } else {
                    Vec::new()
                },
            }
        }
        SearchExpr::Or(left, right) => {
            let left = evaluate_search_expr(left, text);
            let right = evaluate_search_expr(right, text);
            let mut terms = Vec::new();
            if left.matched {
                terms.extend(left.positive_terms);
            }
            if right.matched {
                terms.extend(right.positive_terms);
            }
            QueryEvaluation {
                matched: left.matched || right.matched,
                positive_terms: merge_terms(terms),
            }
        }
        SearchExpr::Nand(left, right) => {
            let left = evaluate_search_expr(left, text);
            let right = evaluate_search_expr(right, text);
            let matched = !(left.matched && right.matched);
            let mut terms = Vec::new();
            if matched && left.matched && !right.matched {
                terms.extend(left.positive_terms);
            }
            if matched && right.matched && !left.matched {
                terms.extend(right.positive_terms);
            }
            QueryEvaluation {
                matched,
                positive_terms: merge_terms(terms),
            }
        }
        SearchExpr::Nor(left, right) => {
            let left = evaluate_search_expr(left, text);
            let right = evaluate_search_expr(right, text);
            QueryEvaluation {
                matched: !(left.matched || right.matched),
                positive_terms: Vec::new(),
            }
        }
        SearchExpr::Xor(left, right) => {
            let left = evaluate_search_expr(left, text);
            let right = evaluate_search_expr(right, text);
            let matched = left.matched ^ right.matched;
            let positive_terms = if matched && left.matched {
                left.positive_terms
            } else if matched && right.matched {
                right.positive_terms
            } else {
                Vec::new()
            };
            QueryEvaluation {
                matched,
                positive_terms: merge_terms(positive_terms),
            }
        }
    }
}

fn find_case_insensitive_ranges(text: &str, term: &str) -> Vec<(usize, usize)> {
    let lower_text = text.to_lowercase();
    let lower_term = term.to_lowercase();
    if lower_term.is_empty() {
        return Vec::new();
    }
    let mut ranges = Vec::new();
    let mut start = 0;
    while let Some(relative_index) = lower_text[start..].find(&lower_term) {
        let range_start = start + relative_index;
        let range_end = range_start + lower_term.len();
        if text.is_char_boundary(range_start) && text.is_char_boundary(range_end) {
            ranges.push((range_start, range_end));
        }
        start = range_start + lower_term.len().max(1);
    }
    ranges
}

fn merge_highlight_ranges(mut ranges: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    ranges.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| b.1.cmp(&a.1)));
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (start, end) in ranges {
        if start >= end {
            continue;
        }
        match merged.last_mut() {
            Some((_, last_end)) if start <= *last_end => {
                *last_end = (*last_end).max(end);
            }
            _ => merged.push((start, end)),
        }
    }
    merged
}

fn boundary_before(text: &str, target: usize) -> usize {
    let mut boundary = 0;
    for (index, _) in text.char_indices() {
        if index > target {
            break;
        }
        boundary = index;
    }
    boundary
}

fn boundary_after(text: &str, target: usize) -> usize {
    for (index, _) in text.char_indices() {
        if index >= target {
            return index;
        }
    }
    text.len()
}

fn make_snippet_parts(text: &str, terms: &[String]) -> (String, Vec<SnippetPart>, i64, Vec<String>) {
    let mut highlight_terms = Vec::new();
    let mut ranges = Vec::new();

    let mut sorted_terms = terms.to_vec();
    sorted_terms.sort_by_key(|term| std::cmp::Reverse(term.len()));
    for term in sorted_terms {
        let term_ranges = find_case_insensitive_ranges(text, &term);
        if !term_ranges.is_empty() {
            highlight_terms.push(term);
            ranges.extend(term_ranges);
        }
    }

    let match_count = ranges.len() as i64;
    let ranges = merge_highlight_ranges(ranges);
    let (snippet_start, snippet_end, prefix_ellipsis, suffix_ellipsis) = if let Some((first_start, first_end)) = ranges.first().copied() {
        let start = boundary_before(text, first_start.saturating_sub(40));
        let end = boundary_after(text, (first_end + 80).min(text.len()));
        (start, end, start > 0, end < text.len())
    } else {
        let end = boundary_after(text, text.char_indices().nth(140).map(|(index, _)| index).unwrap_or(text.len()));
        (0, end, false, end < text.len())
    };

    let mut parts = Vec::new();
    if prefix_ellipsis {
        parts.push(SnippetPart {
            text: "... ".into(),
            highlighted: false,
        });
    }

    let mut cursor = snippet_start;
    for (start, end) in ranges
        .into_iter()
        .filter(|(start, end)| *end > snippet_start && *start < snippet_end)
        .map(|(start, end)| (start.max(snippet_start), end.min(snippet_end)))
    {
        if cursor < start {
            parts.push(SnippetPart {
                text: text[cursor..start].to_string(),
                highlighted: false,
            });
        }
        parts.push(SnippetPart {
            text: text[start..end].to_string(),
            highlighted: true,
        });
        cursor = end;
    }

    if cursor < snippet_end {
        parts.push(SnippetPart {
            text: text[cursor..snippet_end].to_string(),
            highlighted: false,
        });
    }
    if suffix_ellipsis {
        parts.push(SnippetPart {
            text: " ...".into(),
            highlighted: false,
        });
    }

    let snippet = parts.iter().map(|part| part.text.as_str()).collect::<String>();
    (snippet, parts, match_count, merge_terms(highlight_terms))
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

fn is_escaped_at(value: &str, index: usize) -> bool {
    let mut backslash_count = 0;
    for byte in value[..index].bytes().rev() {
        if byte == b'\\' {
            backslash_count += 1;
        } else {
            break;
        }
    }
    backslash_count % 2 == 1
}

fn find_unescaped(value: &str, pattern: &str, start: usize) -> Option<usize> {
    value[start..]
        .match_indices(pattern)
        .map(|(index, _)| start + index)
        .find(|index| !is_escaped_at(value, *index))
}

fn strip_tex_comments(value: &str) -> String {
    value
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(|line| {
            for (index, character) in line.char_indices() {
                if character == '%' && !is_escaped_at(line, index) {
                    return line[..index].to_string();
                }
            }
            line.to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_tex_document_body(value: &str) -> String {
    let Some(begin_index) = value.find(r"\begin{document}") else {
        return value.to_string();
    };
    let body_start = begin_index + r"\begin{document}".len();
    let body = &value[body_start..];
    if let Some(end_index) = body.find(r"\end{document}") {
        body[..end_index].to_string()
    } else {
        body.to_string()
    }
}

fn find_next_math_environment(value: &str, start: usize) -> Option<(usize, String, usize)> {
    let environment_pattern = Regex::new(
        r"\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|split|cases|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}",
    )
    .unwrap();
    let capture = environment_pattern.captures(&value[start..])?;
    let whole_match = capture.get(0)?;
    let environment = capture.get(1)?.as_str().to_string();
    Some((start + whole_match.start(), environment, whole_match.as_str().len()))
}

fn mask_tex_math(value: &str) -> (String, Vec<String>) {
    let mut output = String::new();
    let mut math_segments = Vec::new();
    let mut cursor = 0;

    while cursor < value.len() {
        let mut candidates: Vec<(usize, &str)> = Vec::new();
        if let Some(index) = find_unescaped(value, "$$", cursor) {
            candidates.push((index, "$$"));
        }
        if let Some(index) = find_unescaped(value, "$", cursor) {
            candidates.push((index, "$"));
        }
        if let Some(index) = find_unescaped(value, r"\(", cursor) {
            candidates.push((index, r"\("));
        }
        if let Some(index) = find_unescaped(value, r"\[", cursor) {
            candidates.push((index, r"\["));
        }
        let next_environment = find_next_math_environment(value, cursor);
        if let Some((index, _, _)) = next_environment.as_ref() {
            candidates.push((*index, "env"));
        }

        let Some((start, marker)) = candidates.into_iter().min_by_key(|candidate| candidate.0) else {
            output.push_str(&value[cursor..]);
            break;
        };

        output.push_str(&value[cursor..start]);

        let (end, display_like) = match marker {
            "$$" => find_unescaped(value, "$$", start + 2).map(|index| (index + 2, true)).unwrap_or((value.len(), true)),
            "$" => find_unescaped(value, "$", start + 1).map(|index| (index + 1, false)).unwrap_or((value.len(), false)),
            r"\(" => find_unescaped(value, r"\)", start + 2).map(|index| (index + 2, false)).unwrap_or((value.len(), false)),
            r"\[" => find_unescaped(value, r"\]", start + 2).map(|index| (index + 2, true)).unwrap_or((value.len(), true)),
            _ => {
                let (_, environment, begin_len) = next_environment.expect("math environment candidate exists");
                let end_pattern = format!(r"\end{{{environment}}}");
                let segment_end = value[start + begin_len..]
                    .find(&end_pattern)
                    .map(|index| start + begin_len + index + end_pattern.len())
                    .unwrap_or(value.len());
                (segment_end, true)
            }
        };

        let token = format!("__PMA_TEX_MATH_{}__", math_segments.len());
        math_segments.push(value[start..end].to_string());
        if display_like {
            output.push_str("\n\n");
            output.push_str(&token);
            output.push_str("\n\n");
        } else {
            output.push_str(&token);
        }
        cursor = end;
    }

    (output, math_segments)
}

fn extract_first_braced_argument(value: &str, open_brace: usize) -> Option<(String, usize)> {
    let mut depth = 0;
    let mut content_start = None;
    for (offset, character) in value[open_brace..].char_indices() {
        let index = open_brace + offset;
        if is_escaped_at(value, index) {
            continue;
        }
        match character {
            '{' => {
                depth += 1;
                if depth == 1 {
                    content_start = Some(index + character.len_utf8());
                }
            }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some((value[content_start?..index].to_string(), index + character.len_utf8()));
                }
            }
            _ => {}
        }
    }
    None
}

fn replace_tex_one_argument_commands(mut text: String, commands: &[&str], replacement: fn(&str, &str) -> String) -> String {
    for command in commands {
        let pattern = format!(r"\{command}");
        loop {
            let Some(command_index) = text.find(&pattern) else {
                break;
            };
            let after_command = command_index + pattern.len();
            let whitespace_len = text[after_command..]
                .chars()
                .take_while(|character| character.is_whitespace())
                .map(char::len_utf8)
                .sum::<usize>();
            let brace_index = after_command + whitespace_len;
            if !text[brace_index..].starts_with('{') {
                text.replace_range(command_index..after_command, "");
                continue;
            }
            if let Some((argument, end_index)) = extract_first_braced_argument(&text, brace_index) {
                let next_value = replacement(command, &argument);
                text.replace_range(command_index..end_index, &next_value);
            } else {
                break;
            }
        }
    }
    text
}

fn restore_tex_math(mut text: String, math_segments: &[String]) -> String {
    for (index, segment) in math_segments.iter().enumerate() {
        let token = format!("__PMA_TEX_MATH_{index}__");
        text = text.replace(&token, segment);
    }
    text
}

fn strip_tex_to_plain_text(value: &str) -> String {
    let without_comments = strip_tex_comments(value);
    let body = extract_tex_document_body(&without_comments);
    let (mut text, math_segments) = mask_tex_math(&body);

    text = Regex::new(r"(?s)\\begin\{thebibliography\}.*?\\end\{thebibliography\}")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();
    text = Regex::new(r"(?m)^\s*\\(documentclass|usepackage|newcommand|renewcommand|providecommand|def|let|setlength|pagestyle|bibliographystyle|bibliography)\b.*$")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();

    let section_commands = ["part", "chapter", "section", "subsection", "subsubsection", "paragraph", "subparagraph"];
    text = replace_tex_one_argument_commands(text, &section_commands, |_, argument| format!("\n\n{argument}\n\n"));

    let formatting_commands = [
        "textbf",
        "textit",
        "emph",
        "textrm",
        "textsf",
        "texttt",
        "textsc",
        "underline",
        "small",
        "large",
        "Large",
        "url",
    ];
    text = replace_tex_one_argument_commands(text, &formatting_commands, |_, argument| argument.to_string());
    text = replace_tex_one_argument_commands(text, &["footnote"], |_, argument| format!(" [Note: {argument}] "));
    text = replace_tex_one_argument_commands(text, &["cite", "ref", "eqref"], |command, argument| {
        if command == "cite" {
            format!("[cite: {argument}]")
        } else {
            argument.to_string()
        }
    });
    text = replace_tex_one_argument_commands(text, &["label"], |_, _| String::new());

    text = Regex::new(r"\\begin\{(itemize|enumerate|description)\}")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();
    text = Regex::new(r"\\end\{(itemize|enumerate|description)\}")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();
    text = Regex::new(r"\\begin\{(quote|quotation|abstract|theorem|lemma|proposition|definition|remark|proof)\}")
        .unwrap()
        .replace_all(&text, "\n$1\n")
        .into_owned();
    text = Regex::new(r"\\end\{(quote|quotation|abstract|theorem|lemma|proposition|definition|remark|proof)\}")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();
    text = Regex::new(r"\\begin\{[^}]+\}|\\end\{[^}]+\}")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();

    text = Regex::new(r"\\item(?:\[[^\]]+\])?\s*")
        .unwrap()
        .replace_all(&text, "\n- ")
        .into_owned();
    text = Regex::new(r"\\\\")
        .unwrap()
        .replace_all(&text, "\n")
        .into_owned();
    text = Regex::new(r"\\par\b")
        .unwrap()
        .replace_all(&text, "\n\n")
        .into_owned();

    text = replace_tex_one_argument_commands(text, &["text", "mbox"], |_, argument| argument.to_string());
    text = Regex::new(r"\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])?\s*\{([^{}]*)\}")
        .unwrap()
        .replace_all(&text, "$1")
        .into_owned();
    text = Regex::new(r"\\[a-zA-Z]+\*?")
        .unwrap()
        .replace_all(&text, "")
        .into_owned();
    text = text
        .replace(r"\%", "%")
        .replace(r"\&", "&")
        .replace(r"\_", "_")
        .replace(r"\#", "#")
        .replace(r"\{", "{")
        .replace(r"\}", "}")
        .replace('~', " ");

    normalize_plain_text(&restore_tex_math(text, &math_segments))
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
        Some("tex") => {
            let bytes = fs::read(path)?;
            Ok(Some(strip_tex_to_plain_text(&String::from_utf8_lossy(&bytes))))
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
        Some("tex") => "tex".into(),
        Some("docx") => "docx".into(),
        Some("txt") => "txt".into(),
        Some("pdf") => "pdf".into(),
        Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp") | Some("bmp") | Some("tif")
        | Some("tiff") => "image".into(),
        Some(other) => other.to_string(),
        None => "file".into(),
    }
}

fn default_batch_entry_title(source: &Path) -> String {
    source
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Untitled")
        .to_string()
}

fn insert_batch_entry(transaction: &Transaction<'_>, entry_id: &str, title: &str, now: &str) -> ArchiveResult<()> {
    transaction.execute(
        "
        INSERT INTO entries (
          id, title, entry_type, date_year, date_month, date_day,
          date_year_uncertain, date_month_uncertain, date_day_uncertain, date_note,
          description, tags_json, page_count, notes, created_at, updated_at
        ) VALUES (?1, ?2, NULL, NULL, NULL, NULL, 1, 1, 1, NULL, NULL, '[]', 0, NULL, ?3, ?4)
        ",
        params![entry_id, title, now, now],
    )?;
    Ok(())
}

fn import_batch_pdf(
    root: &Path,
    transaction: &Transaction<'_>,
    source: &Path,
    entry_id: &str,
    now: &str,
) -> ArchiveResult<Option<String>> {
    let page_count = read_pdf_page_count(source)? as i64;
    if page_count <= 0 {
        return Err(ArchiveError::Message("PDF contains no pages.".into()));
    }

    let asset_id = next_id(transaction, "asset", "A")?;
    let relative_pdf = relative_source_pdf_path(&asset_id);
    let destination = absolute_asset_path(root, &relative_pdf);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, &destination)?;

    let file_label = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());
    transaction.execute(
        "
        INSERT INTO assets (
          id, entry_id, asset_type, file_path, label, notes, created_at, updated_at
        ) VALUES (?1, ?2, 'pdf', ?3, ?4, NULL, ?5, ?6)
        ",
        params![asset_id.as_str(), entry_id, relative_pdf.as_str(), file_label, now, now],
    )?;

    let has_legacy_pdf_page_index = column_exists(transaction, "pages", "pdf_page_index")?;
    let mut first_page_id = None;
    for pdf_page_index in 0..page_count {
        let page_id = next_id(transaction, "page", "P")?;
        if first_page_id.is_none() {
            first_page_id = Some(page_id.clone());
        }
        let sort_order = pdf_page_index + 1;
        insert_page_row(
            transaction,
            has_legacy_pdf_page_index,
            &NewPageRow {
                id: page_id.as_str(),
                entry_id,
                page_number: sort_order,
                sort_order,
                source_asset_id: Some(asset_id.as_str()),
                source_pdf_path: Some(relative_pdf.as_str()),
                source_pdf_page_index: pdf_page_index,
                original_page_number: Some(pdf_page_index + 1),
                transcription_text: None,
                summary: None,
                keywords_json: Some("[]"),
                page_notes: None,
                created_at: now,
                updated_at: now,
            },
        )?;
    }

    transaction.execute(
        "
        UPDATE entries
        SET page_count = ?2, updated_at = ?3
        WHERE id = ?1
        ",
        params![entry_id, page_count, now],
    )?;

    Ok(first_page_id)
}

fn import_batch_resource(
    root: &Path,
    transaction: &Transaction<'_>,
    source: &Path,
    entry_id: &str,
    now: &str,
) -> ArchiveResult<Option<String>> {
    let extracted = extract_plain_text_from_path(source)?
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| ArchiveError::Message("Unable to extract plain text from this file.".into()))?;

    let asset_id = next_id(transaction, "asset", "A")?;
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let relative_path = relative_resource_path(&asset_id, extension.as_deref());
    let destination = absolute_asset_path(root, &relative_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, &destination)?;

    let file_label = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());
    transaction.execute(
        "
        INSERT INTO assets (
          id, entry_id, asset_type, file_path, label, notes, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)
        ",
        params![
            asset_id.as_str(),
            entry_id,
            detect_asset_type(source),
            relative_path.as_str(),
            file_label,
            now,
            now
        ],
    )?;

    let page_id = next_id(transaction, "page", "P")?;
    let has_legacy_pdf_page_index = column_exists(transaction, "pages", "pdf_page_index")?;
    insert_page_row(
        transaction,
        has_legacy_pdf_page_index,
        &NewPageRow {
            id: page_id.as_str(),
            entry_id,
            page_number: 1,
            sort_order: 1,
            source_asset_id: Some(asset_id.as_str()),
            source_pdf_path: None,
            source_pdf_page_index: 0,
            original_page_number: None,
            transcription_text: Some(extracted.trim()),
            summary: None,
            keywords_json: Some("[]"),
            page_notes: None,
            created_at: now,
            updated_at: now,
        },
    )?;
    transaction.execute(
        "
        UPDATE entries
        SET page_count = 1, updated_at = ?2
        WHERE id = ?1
        ",
        params![entry_id, now],
    )?;

    Ok(Some(page_id))
}

fn import_batch_source(root: &Path, connection: &mut Connection, source: &Path) -> ArchiveResult<(String, Option<String>)> {
    if !source.exists() {
        return Err(ArchiveError::Message("The selected file does not exist.".into()));
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    let transaction = connection.transaction()?;
    let now = now_iso();
    let entry_id = next_id(&transaction, "entry", "E")?;
    insert_batch_entry(
        &transaction,
        entry_id.as_str(),
        default_batch_entry_title(source).as_str(),
        now.as_str(),
    )?;

    let selected_page_id = match extension.as_deref() {
        Some("pdf") => import_batch_pdf(root, &transaction, source, entry_id.as_str(), now.as_str())?,
        Some("txt") | Some("md") | Some("docx") | Some("tex") => {
            import_batch_resource(root, &transaction, source, entry_id.as_str(), now.as_str())?
        }
        _ => {
            return Err(ArchiveError::Message(
                "Batch import currently supports PDF, TXT, Markdown, DOCX, and TeX files.".into(),
            ));
        }
    };

    transaction.commit()?;
    Ok((entry_id, selected_page_id))
}

fn load_snapshot_internal(root: &Path) -> ArchiveResult<ArchiveSnapshot> {
    let connection = connection_for_root(root)?;
    let mut entry_statement = connection.prepare(
        "
        SELECT
          id, title, entry_type, date_year, date_month, date_day,
          date_year_uncertain, date_month_uncertain, date_day_uncertain, date_note,
          description, tags_json, page_count, notes, created_at, updated_at
        FROM entries
        ORDER BY
          COALESCE(entry_type, '') ASC,
          CASE WHEN date_year IS NULL OR date_year_uncertain = 1 THEN 1 ELSE 0 END ASC,
          date_year ASC,
          CASE WHEN date_month IS NULL OR date_month_uncertain = 1 THEN 1 ELSE 0 END ASC,
          date_month ASC,
          CASE WHEN date_day IS NULL OR date_day_uncertain = 1 THEN 1 ELSE 0 END ASC,
          date_day ASC,
          title COLLATE NOCASE ASC,
          id ASC
        ",
    )?;

    let entry_rows = entry_statement.query_map([], |row| {
        Ok(EntryRecord {
            id: row.get(0)?,
            title: row.get(1)?,
            entry_type: row.get(2)?,
            date_year: row.get(3)?,
            date_month: row.get(4)?,
            date_day: row.get(5)?,
            date_year_uncertain: row.get(6)?,
            date_month_uncertain: row.get(7)?,
            date_day_uncertain: row.get(8)?,
            date_note: row.get(9)?,
            description: row.get(10)?,
            tags_json: row.get(11)?,
            page_count: row.get(12)?,
            notes: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;

    let entries: Vec<EntryRecord> = entry_rows.collect::<Result<_, _>>()?;
    let mut page_statement = connection.prepare(
        "
        SELECT
          id, entry_id, page_number, page_label, sort_order, source_asset_id,
          source_pdf_path, source_pdf_page_index, original_page_number, transcription_text,
          summary, keywords_json, page_notes, created_at, updated_at
        FROM pages
        WHERE entry_id = ?1
        ORDER BY sort_order ASC, id ASC
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
                sort_order: row.get(4)?,
                source_asset_id: row.get(5)?,
                source_pdf_path: row.get(6)?,
                source_pdf_page_index: row.get(7)?,
                original_page_number: row.get(8)?,
                transcription_text: row.get(9)?,
                summary: row.get(10)?,
                keywords_json: row.get(11)?,
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

    let asset_row: Option<(String, String, String)> = connection
        .query_row(
            "SELECT entry_id, file_path, asset_type FROM assets WHERE id = ?1",
            params![asset_id.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(to_tauri_error)?;

    let Some((entry_id, relative_path, asset_type)) = asset_row else {
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
    if asset_type == "pdf" {
        connection
            .execute("DELETE FROM pages WHERE source_asset_id = ?1", params![asset_id.as_str()])
            .map_err(to_tauri_error)?;
    }
    connection
        .execute("DELETE FROM assets WHERE id = ?1", params![asset_id.as_str()])
        .map_err(to_tauri_error)?;
    connection
        .execute(
            "
            UPDATE entries
            SET updated_at = ?2, page_count = (SELECT COUNT(*) FROM pages WHERE entry_id = ?1)
            WHERE id = ?1
            ",
            params![entry_id.as_str(), now.as_str()],
        )
        .map_err(to_tauri_error)?;

    load_snapshot_internal(&root).map_err(to_tauri_error)
}

#[tauri::command]
pub fn create_entry(root_path: String, input: CreateEntryInput) -> Result<CreateEntryResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;
    let entry_id = next_id(&transaction, "entry", "E").map_err(to_tauri_error)?;
    let now = now_iso();
    let tags_json = serde_json::to_string(&input.tags).map_err(|error| error.to_string())?;
    transaction
        .execute(
            "
            INSERT INTO entries (
              id, title, entry_type, date_year, date_month, date_day,
              date_year_uncertain, date_month_uncertain, date_day_uncertain, date_note,
              description, tags_json, page_count, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            ",
            params![
                entry_id.as_str(),
                input.title.trim(),
                clean_optional(&input.entry_type),
                input.date_year,
                input.date_month,
                input.date_day,
                input.date_year_uncertain,
                input.date_month_uncertain,
                input.date_day_uncertain,
                clean_optional(&input.date_note),
                clean_optional(&input.description),
                tags_json,
                0,
                clean_optional(&input.notes),
                now.as_str(),
                now.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(CreateEntryResult {
        snapshot,
        selected_entry_id: entry_id,
        selected_page_id: None,
    })
}

#[tauri::command]
pub fn import_entry_pdf(root_path: String, input: ImportEntryPdfInput) -> Result<CreateEntryResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let source_path = PathBuf::from(input.source_path.trim());
    if !source_path.exists() {
        return Err("The selected PDF file does not exist.".into());
    }

    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;
    let asset_id = next_id(&transaction, "asset", "A").map_err(to_tauri_error)?;
    let relative_pdf = relative_source_pdf_path(&asset_id);
    let destination_path = absolute_asset_path(&root, &relative_pdf);
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(to_tauri_error)?;
    }
    fs::copy(&source_path, &destination_path).map_err(to_tauri_error)?;

    let now = now_iso();
    let file_label = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());
    let existing_page_count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM pages WHERE entry_id = ?1",
            params![input.entry_id.as_str()],
            |row| row.get(0),
        )
        .map_err(to_tauri_error)?;
    let pdf_page_count = read_pdf_page_count(&source_path).map_err(to_tauri_error)? as i64;
    let has_legacy_pdf_page_index = column_exists(&transaction, "pages", "pdf_page_index").map_err(to_tauri_error)?;
    let mut range_start = input.page_start.filter(|value| *value > 0).unwrap_or(1);
    let mut range_end = input.page_end.filter(|value| *value > 0).unwrap_or(pdf_page_count);

    range_start = range_start.min(pdf_page_count);
    range_end = range_end.min(pdf_page_count);

    if range_start < 1 || range_end < 1 || range_start > range_end {
        return Err("Invalid PDF page range. Leave both fields empty to import all pages.".into());
    }

    transaction
        .execute(
            "
            INSERT INTO assets (
              id, entry_id, asset_type, file_path, label, notes, created_at, updated_at
            ) VALUES (?1, ?2, 'pdf', ?3, ?4, NULL, ?5, ?6)
            ",
            params![
                asset_id.as_str(),
                input.entry_id.as_str(),
                relative_pdf.as_str(),
                file_label,
                now.as_str(),
                now.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    let mut first_page_id: Option<String> = None;
    for pdf_page_index in (range_start - 1)..range_end {
        let page_id = next_id(&transaction, "page", "P").map_err(to_tauri_error)?;
        if first_page_id.is_none() {
            first_page_id = Some(page_id.clone());
        }
        let sort_order = existing_page_count + (pdf_page_index - (range_start - 1)) + 1;
        insert_page_row(
            &transaction,
            has_legacy_pdf_page_index,
            &NewPageRow {
                id: page_id.as_str(),
                entry_id: input.entry_id.as_str(),
                page_number: sort_order,
                sort_order,
                source_asset_id: Some(asset_id.as_str()),
                source_pdf_path: Some(relative_pdf.as_str()),
                source_pdf_page_index: pdf_page_index,
                original_page_number: Some(pdf_page_index + 1),
                transcription_text: None,
                summary: None,
                keywords_json: Some("[]"),
                page_notes: None,
                created_at: now.as_str(),
                updated_at: now.as_str(),
            },
        )
        .map_err(to_tauri_error)?;
    }

    transaction
        .execute(
            "
            UPDATE entries
            SET page_count = (SELECT COUNT(*) FROM pages WHERE entry_id = ?1), updated_at = ?2
            WHERE id = ?1
            ",
            params![input.entry_id.as_str(), now.as_str()],
        )
        .map_err(to_tauri_error)?;

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(CreateEntryResult {
        snapshot,
        selected_entry_id: input.entry_id,
        selected_page_id: first_page_id,
    })
}

#[tauri::command]
pub fn batch_import_files(root_path: String, input: BatchImportInput) -> Result<BatchImportResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let mut results = Vec::new();
    let mut imported_count = 0;
    let mut failed_count = 0;

    for source_path in input.source_paths {
        let trimmed = source_path.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }
        let source = PathBuf::from(trimmed.as_str());
        match import_batch_source(&root, &mut connection, &source) {
            Ok((entry_id, selected_page_id)) => {
                imported_count += 1;
                results.push(BatchImportItemResult {
                    source_path: trimmed,
                    entry_id: Some(entry_id),
                    selected_page_id,
                    status: "imported".into(),
                    error: None,
                });
            }
            Err(error) => {
                failed_count += 1;
                results.push(BatchImportItemResult {
                    source_path: trimmed,
                    entry_id: None,
                    selected_page_id: None,
                    status: "failed".into(),
                    error: Some(error.to_string()),
                });
            }
        }
    }

    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(BatchImportResult {
        snapshot,
        imported_count,
        failed_count,
        results,
    })
}

#[tauri::command]
pub fn move_page(root_path: String, input: PageMutationInput) -> Result<PageMutationResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;

    if !entry_exists(&transaction, input.target_entry_id.as_str()).map_err(to_tauri_error)? {
        return Err("The target entry does not exist.".into());
    }

    let source_entry_id: String = transaction
        .query_row(
            "SELECT entry_id FROM pages WHERE id = ?1",
            params![input.page_id.as_str()],
            |row| row.get(0),
        )
        .optional()
        .map_err(to_tauri_error)?
        .ok_or_else(|| "The selected page does not exist.".to_string())?;

    let now = now_iso();
    if source_entry_id == input.target_entry_id {
        let mut page_ids = load_page_ids_for_entry(&transaction, source_entry_id.as_str()).map_err(to_tauri_error)?;
        page_ids.retain(|page_id| page_id != &input.page_id);
        let insert_index = resolve_insert_index(&page_ids, input.target_before_page_id.as_deref());
        page_ids.insert(insert_index, input.page_id.clone());
        apply_page_order(&transaction, source_entry_id.as_str(), &page_ids, now.as_str()).map_err(to_tauri_error)?;
    } else {
        let mut source_page_ids =
            load_page_ids_for_entry(&transaction, source_entry_id.as_str()).map_err(to_tauri_error)?;
        source_page_ids.retain(|page_id| page_id != &input.page_id);

        let mut target_page_ids =
            load_page_ids_for_entry(&transaction, input.target_entry_id.as_str()).map_err(to_tauri_error)?;
        let insert_index = resolve_insert_index(&target_page_ids, input.target_before_page_id.as_deref());
        target_page_ids.insert(insert_index, input.page_id.clone());

        apply_page_order(&transaction, source_entry_id.as_str(), &source_page_ids, now.as_str()).map_err(to_tauri_error)?;
        apply_page_order(&transaction, input.target_entry_id.as_str(), &target_page_ids, now.as_str())
            .map_err(to_tauri_error)?;
    }

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(PageMutationResult {
        snapshot,
        selected_entry_id: Some(input.target_entry_id),
        selected_page_id: Some(input.page_id),
    })
}

#[tauri::command]
pub fn copy_page(root_path: String, input: PageMutationInput) -> Result<PageMutationResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;

    if !entry_exists(&transaction, input.target_entry_id.as_str()).map_err(to_tauri_error)? {
        return Err("The target entry does not exist.".into());
    }

    let source_page: PageRecord = transaction
        .query_row(
            "
            SELECT
              id, entry_id, page_number, page_label, sort_order, source_asset_id,
              source_pdf_path, source_pdf_page_index, original_page_number, transcription_text,
              summary, keywords_json, page_notes, created_at, updated_at
            FROM pages
            WHERE id = ?1
            ",
            params![input.page_id.as_str()],
            |row| {
                Ok(PageRecord {
                    id: row.get(0)?,
                    entry_id: row.get(1)?,
                    page_number: row.get(2)?,
                    page_label: row.get(3)?,
                    sort_order: row.get(4)?,
                    source_asset_id: row.get(5)?,
                    source_pdf_path: row.get(6)?,
                    source_pdf_page_index: row.get(7)?,
                    original_page_number: row.get(8)?,
                    transcription_text: row.get(9)?,
                    summary: row.get(10)?,
                    keywords_json: row.get(11)?,
                    page_notes: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .optional()
        .map_err(to_tauri_error)?
        .ok_or_else(|| "The selected page does not exist.".to_string())?;
    let has_legacy_pdf_page_index = column_exists(&transaction, "pages", "pdf_page_index").map_err(to_tauri_error)?;

    let page_id = next_id(&transaction, "page", "P").map_err(to_tauri_error)?;
    let now = now_iso();
    insert_page_row(
        &transaction,
        has_legacy_pdf_page_index,
        &NewPageRow {
            id: page_id.as_str(),
            entry_id: input.target_entry_id.as_str(),
            page_number: source_page.page_number.unwrap_or(1),
            sort_order: 0,
            source_asset_id: source_page.source_asset_id.as_deref(),
            source_pdf_path: source_page.source_pdf_path.as_deref(),
            source_pdf_page_index: source_page.source_pdf_page_index,
            original_page_number: source_page.original_page_number,
            transcription_text: source_page.transcription_text.as_deref(),
            summary: source_page.summary.as_deref(),
            keywords_json: source_page.keywords_json.as_deref(),
            page_notes: source_page.page_notes.as_deref(),
            created_at: now.as_str(),
            updated_at: now.as_str(),
        },
    )
    .map_err(to_tauri_error)?;

    let mut target_page_ids =
        load_page_ids_for_entry(&transaction, input.target_entry_id.as_str()).map_err(to_tauri_error)?;
    let insert_index = resolve_insert_index(&target_page_ids, input.target_before_page_id.as_deref());
    target_page_ids.insert(insert_index, page_id.clone());
    apply_page_order(&transaction, input.target_entry_id.as_str(), &target_page_ids, now.as_str())
        .map_err(to_tauri_error)?;

    transaction.commit().map_err(to_tauri_error)?;
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(PageMutationResult {
        snapshot,
        selected_entry_id: Some(input.target_entry_id),
        selected_page_id: Some(page_id),
    })
}

#[tauri::command]
pub fn remove_page(root_path: String, input: RemovePageInput) -> Result<PageMutationResult, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let mut connection = connection_for_root(&root).map_err(to_tauri_error)?;
    let transaction = connection.transaction().map_err(to_tauri_error)?;

    let source_entry_id: String = transaction
        .query_row(
            "SELECT entry_id FROM pages WHERE id = ?1",
            params![input.page_id.as_str()],
            |row| row.get(0),
        )
        .optional()
        .map_err(to_tauri_error)?
        .ok_or_else(|| "The selected page does not exist.".to_string())?;

    transaction
        .execute("DELETE FROM pages WHERE id = ?1", params![input.page_id.as_str()])
        .map_err(to_tauri_error)?;

    let now = now_iso();
    let remaining_page_ids =
        load_page_ids_for_entry(&transaction, source_entry_id.as_str()).map_err(to_tauri_error)?;
    apply_page_order(&transaction, source_entry_id.as_str(), &remaining_page_ids, now.as_str())
        .map_err(to_tauri_error)?;

    transaction.commit().map_err(to_tauri_error)?;
    let selected_page_id = remaining_page_ids.first().cloned();
    let snapshot = load_snapshot_internal(&root).map_err(to_tauri_error)?;
    Ok(PageMutationResult {
        snapshot,
        selected_entry_id: Some(source_entry_id),
        selected_page_id,
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
              date_year = ?4,
              date_month = ?5,
              date_day = ?6,
              date_year_uncertain = ?7,
              date_month_uncertain = ?8,
              date_day_uncertain = ?9,
              date_note = ?10,
              description = ?11,
              tags_json = ?12,
              notes = ?13,
              updated_at = ?14
            WHERE id = ?1
            ",
            params![
                entry.id.as_str(),
                entry.title.trim(),
                entry.entry_type.as_deref(),
                entry.date_year,
                entry.date_month,
                entry.date_day,
                entry.date_year_uncertain,
                entry.date_month_uncertain,
                entry.date_day_uncertain,
                entry.date_note.as_deref(),
                entry.description.as_deref(),
                entry.tags_json.as_deref(),
                entry.notes.as_deref(),
                updated_at.as_str()
            ],
        )
        .map_err(to_tauri_error)?;

    connection
        .query_row(
            "
            SELECT
              id, title, entry_type, date_year, date_month, date_day,
              date_year_uncertain, date_month_uncertain, date_day_uncertain, date_note,
              description, tags_json, page_count, notes, created_at, updated_at
            FROM entries
            WHERE id = ?1
            ",
            params![entry.id.as_str()],
            |row| {
                Ok(EntryRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    entry_type: row.get(2)?,
                    date_year: row.get(3)?,
                    date_month: row.get(4)?,
                    date_day: row.get(5)?,
                    date_year_uncertain: row.get(6)?,
                    date_month_uncertain: row.get(7)?,
                    date_day_uncertain: row.get(8)?,
                    date_note: row.get(9)?,
                    description: row.get(10)?,
                    tags_json: row.get(11)?,
                    page_count: row.get(12)?,
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
              sort_order = ?4,
              original_page_number = ?5,
              transcription_text = ?6,
              summary = ?7,
              keywords_json = ?8,
              page_notes = ?9,
              updated_at = ?10
            WHERE id = ?1
            ",
            params![
                page.id.as_str(),
                page.page_number,
                page.page_label.as_deref(),
                page.sort_order,
                page.original_page_number,
                page.transcription_text.as_deref(),
                page.summary.as_deref(),
                page.keywords_json.as_deref(),
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
              id, entry_id, page_number, page_label, sort_order, source_asset_id,
              source_pdf_path, source_pdf_page_index, original_page_number, transcription_text,
              summary, keywords_json, page_notes, created_at, updated_at
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
                    sort_order: row.get(4)?,
                    source_asset_id: row.get(5)?,
                    source_pdf_path: row.get(6)?,
                    source_pdf_page_index: row.get(7)?,
                    original_page_number: row.get(8)?,
                    transcription_text: row.get(9)?,
                    summary: row.get(10)?,
                    keywords_json: row.get(11)?,
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

    let expression = parse_search_query(trimmed_query).map_err(|error| error.to_string())?;
    let sql = if mode == "full_text" {
        "
        SELECT
          'page' AS result_type,
          e.id,
          p.id,
          e.title,
          p.page_number,
          TRIM(COALESCE(p.transcription_text, '') || char(10) || COALESCE(p.summary, '') || char(10) || COALESCE(p.page_notes, '')),
          'transcription_text'
        FROM pages p
        JOIN entries e ON e.id = p.entry_id
        ORDER BY e.updated_at DESC, p.sort_order ASC
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
          TRIM(COALESCE(e.title, '') || char(10) || COALESCE(e.description, '') || char(10) || COALESCE(e.entry_type, '') || char(10) || COALESCE(e.tags_json, '') || char(10) || COALESCE(p.summary, '') || char(10) || COALESCE(p.keywords_json, '') || char(10) || COALESCE(p.page_notes, '')),
          'description'
        FROM entries e
        LEFT JOIN pages p ON p.entry_id = e.id
        ORDER BY e.updated_at DESC
        "
    };

    let mut statement = connection.prepare(sql).map_err(to_tauri_error)?;
    let rows = statement
        .query_map([], |row| {
            let result_type: String = row.get(0)?;
            let entry_id: String = row.get(1)?;
            let page_id: Option<String> = row.get(2)?;
            let entry_title: String = row.get(3)?;
            let page_number: Option<i64> = row.get(4)?;
            let source_text: String = row.get(5)?;
            let matched_field: String = row.get(6)?;
            Ok(SearchCandidate {
                result_type,
                entry_id,
                page_id,
                entry_title,
                page_number,
                source_text,
                matched_field,
            })
        })
        .map_err(to_tauri_error)?;

    let candidates = rows.collect::<Result<Vec<_>, _>>().map_err(to_tauri_error)?;
    let mut results = Vec::new();

    for candidate in candidates {
        let evaluation = evaluate_search_expr(&expression, &candidate.source_text);
        if !evaluation.matched {
            continue;
        }

        let label = if candidate.result_type == "page" {
            match candidate.page_number {
                Some(number) => format!("{} - Page {}", candidate.entry_title, number),
                None => format!("{} - Page", candidate.entry_title),
            }
        } else {
            candidate.entry_title.clone()
        };
        let (snippet, snippet_parts, match_count, highlight_terms) =
            make_snippet_parts(&candidate.source_text, &evaluation.positive_terms);

        results.push(SearchResult {
            result_type: candidate.result_type,
            entry_id: candidate.entry_id,
            page_id: candidate.page_id,
            entry_title: candidate.entry_title,
            page_number: candidate.page_number,
            label,
            snippet,
            snippet_parts,
            highlight_terms,
            match_count,
            query_summary: None,
            matched_field: candidate.matched_field,
        });

        if results.len() >= 200 {
            break;
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn delete_entry(root_path: String, entry_id: String) -> Result<ArchiveSnapshot, String> {
    let root = normalize_root(&root_path).map_err(to_tauri_error)?;
    let connection = connection_for_root(&root).map_err(to_tauri_error)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tex_extracts_plain_document_text() {
        let output = strip_tex_to_plain_text(
            r"
            \documentclass{article}
            \begin{document}
            This is plain text.

            This is another paragraph.
            \end{document}
            ",
        );

        assert!(output.contains("This is plain text."));
        assert!(output.contains("This is another paragraph."));
        assert!(!output.contains(r"\documentclass"));
    }

    #[test]
    fn tex_keeps_section_titles_as_text() {
        let output = strip_tex_to_plain_text(
            r"
            \begin{document}
            \section{Main Title}
            \subsection{Minor Title}
            Body text.
            \end{document}
            ",
        );

        assert!(output.contains("Main Title"));
        assert!(output.contains("Minor Title"));
        assert!(!output.contains(r"\section"));
    }

    #[test]
    fn tex_preserves_inline_math() {
        let output = strip_tex_to_plain_text(r"We define $f(x)=x^2$ and \(a_n\to 0\).");

        assert!(output.contains(r"$f(x)=x^2$"));
        assert!(output.contains(r"\(a_n\to 0\)"));
    }

    #[test]
    fn tex_preserves_display_math() {
        let output = strip_tex_to_plain_text(
            r"
            We have
            \[
            \int_0^1 f(x)\,dx
            \]
            therefore.
            ",
        );

        assert!(output.contains(r"\["));
        assert!(output.contains(r"\int_0^1 f(x)\,dx"));
        assert!(output.contains("therefore."));
    }

    #[test]
    fn tex_preserves_equation_and_align_environments() {
        let equation = strip_tex_to_plain_text(
            r"
            \begin{equation}
            E = mc^2
            \end{equation}
            ",
        );
        let align = strip_tex_to_plain_text(
            r"
            \begin{align}
            a &= b+c\\
            d &= e
            \end{align}
            ",
        );

        assert!(equation.contains(r"\begin{equation}"));
        assert!(equation.contains("E = mc^2"));
        assert!(align.contains(r"\begin{align}"));
        assert!(align.contains(r"a &= b+c\\"));
    }

    #[test]
    fn tex_extracts_footnote_text() {
        let output = strip_tex_to_plain_text(r"Text\footnote{Important note} continues.");

        assert!(output.contains("Text"));
        assert!(output.contains("Important note"));
        assert!(output.contains("continues."));
    }

    #[test]
    fn tex_extracts_list_items() {
        let output = strip_tex_to_plain_text(
            r"
            \begin{itemize}
            \item First item
            \item Second item
            \end{itemize}
            ",
        );

        assert!(output.contains("- First item"));
        assert!(output.contains("- Second item"));
        assert!(!output.contains(r"\begin{itemize}"));
    }

    #[test]
    fn tex_keeps_unknown_command_argument_text() {
        let output = strip_tex_to_plain_text(r"Before \unknowncommand{valuable text} after.");

        assert!(output.contains("valuable text"));
        assert!(!output.contains(r"\unknowncommand"));
    }

    #[test]
    fn tex_extracts_without_document_environment() {
        let output = strip_tex_to_plain_text(r"\textbf{Standalone text}");

        assert_eq!(output, "Standalone text");
    }

    #[test]
    fn tex_removes_comments_without_touching_escaped_percent() {
        let output = strip_tex_to_plain_text(
            r"
            Visible 100\% text. % hidden comment
            % whole line hidden
            Still visible.
            ",
        );

        assert!(output.contains("Visible 100% text."));
        assert!(output.contains("Still visible."));
        assert!(!output.contains("hidden comment"));
        assert!(!output.contains("whole line hidden"));
    }

    fn query_matches(query: &str, text: &str) -> bool {
        let expression = parse_search_query(query).expect("query should parse");
        evaluate_search_expr(&expression, text).matched
    }

    #[test]
    fn search_query_matches_single_word_and_quoted_phrase() {
        assert!(query_matches("sanskrit", "A Sanskrit grammar note."));
        assert!(query_matches("\"socialist china\"", "Notes on Socialist China in translation."));
        assert!(!query_matches("\"socialist china\"", "Socialist debates in China."));
    }

    #[test]
    fn search_query_supports_and_or_not() {
        assert!(query_matches("\"sanskrit\" AND \"grammar\"", "Sanskrit grammar."));
        assert!(query_matches("\"sanskrit\" OR \"pali\"", "Pali grammar."));
        assert!(query_matches("\"sanskrit\" AND NOT \"pali\"", "Sanskrit grammar."));
        assert!(!query_matches("\"sanskrit\" AND NOT \"pali\"", "Sanskrit and Pali grammar."));
    }

    #[test]
    fn search_query_supports_nand_nor_xor() {
        assert!(query_matches("\"sanskrit\" NAND \"pali\"", "Sanskrit grammar."));
        assert!(!query_matches("\"sanskrit\" NAND \"pali\"", "Sanskrit Pali grammar."));
        assert!(query_matches("\"sanskrit\" NOR \"pali\"", "Greek grammar."));
        assert!(!query_matches("\"sanskrit\" NOR \"pali\"", "Pali grammar."));
        assert!(query_matches("\"sanskrit\" XOR \"pali\"", "Sanskrit grammar."));
        assert!(!query_matches("\"sanskrit\" XOR \"pali\"", "Sanskrit Pali grammar."));
    }

    #[test]
    fn search_query_distinguishes_literal_text_from_logic() {
        assert!(query_matches("\"A\" AND \"B\"", "A and B are separate letters."));
        assert!(!query_matches("\"A\" AND \"B\"", "A alone."));
        assert!(query_matches("\"A AND B\"", "The literal A AND B appears here."));
        assert!(!query_matches("\"A AND B\"", "A plus B appear separately."));
        assert!(query_matches("\"AND\"", "The word AND is literal."));
    }

    #[test]
    fn search_query_uses_operator_precedence_and_parentheses() {
        assert!(query_matches("\"A\" OR \"B\" AND \"C\"", "B C"));
        assert!(!query_matches("(\"A\" OR \"B\") AND \"C\"", "A only"));
        assert!(query_matches("(\"A\" OR \"B\") AND \"C\"", "A plus C"));
    }

    #[test]
    fn search_snippet_handles_start_middle_and_end_matches() {
        let (start_snippet, start_parts, _, _) = make_snippet_parts("grammar begins this note", &["grammar".into()]);
        let (middle_snippet, middle_parts, _, _) =
            make_snippet_parts("Before the long Sanskrit grammar passage after.", &["grammar".into()]);
        let (end_snippet, end_parts, _, _) = make_snippet_parts("This note ends with grammar", &["grammar".into()]);

        assert!(start_snippet.starts_with("grammar"));
        assert!(middle_snippet.contains("grammar"));
        assert!(end_snippet.ends_with("grammar"));
        assert!(start_parts.iter().any(|part| part.highlighted));
        assert!(middle_parts.iter().any(|part| part.highlighted));
        assert!(end_parts.iter().any(|part| part.highlighted));
    }

    #[test]
    fn search_highlight_merges_overlap_and_counts_multiple_matches() {
        let (snippet, parts, count, terms) =
            make_snippet_parts("socialist china and socialist thought", &["socialist china".into(), "socialist".into()]);

        assert!(snippet.contains("socialist china"));
        assert!(count >= 3);
        assert!(terms.iter().any(|term| term.eq_ignore_ascii_case("socialist china")));
        assert!(parts.iter().any(|part| part.highlighted && part.text.eq_ignore_ascii_case("socialist china")));

        let (_, adjacent_parts, _, _) = make_snippet_parts("abab", &["ab".into()]);
        let highlighted = adjacent_parts
            .iter()
            .filter(|part| part.highlighted)
            .map(|part| part.text.as_str())
            .collect::<Vec<_>>()
            .join("");
        assert_eq!(highlighted, "abab");
    }

    #[test]
    fn search_query_rejects_invalid_syntax() {
        assert!(parse_search_query("\"unterminated").is_err());
        assert!(parse_search_query("\"A\" AND OR \"B\"").is_err());
        assert!(parse_search_query("NOT").is_err());
        assert!(parse_search_query("\"A\" AND").is_err());
        assert!(parse_search_query("\"A\" \"B\"").is_err());
    }
}
