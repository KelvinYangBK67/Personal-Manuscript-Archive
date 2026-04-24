export type SearchMode = "metadata" | "full_text";
export type EditorTab = "metadata" | "transcription" | "resources";
export type DatePartMode = "known" | "uncertain";

export interface EntryRecord {
  id: string;
  title: string;
  entry_type: string | null;
  date_year: number | null;
  date_month: number | null;
  date_day: number | null;
  date_year_uncertain: number;
  date_month_uncertain: number;
  date_day_uncertain: number;
  date_note: string | null;
  description: string | null;
  tags_json: string | null;
  page_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageRecord {
  id: string;
  entry_id: string;
  page_number: number | null;
  page_label: string | null;
  sort_order: number;
  source_asset_id: string | null;
  source_pdf_path: string | null;
  source_pdf_page_index: number;
  original_page_number: number | null;
  transcription_text: string | null;
  summary: string | null;
  keywords_json: string | null;
  page_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRecord {
  id: string;
  entry_id: string;
  asset_type: string;
  file_path: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntryWithPages {
  entry: EntryRecord;
  pages: PageRecord[];
  assets: AssetRecord[];
}

export interface ArchiveSnapshot {
  archive_root: string;
  entries: EntryWithPages[];
}

export interface SearchResult {
  result_type: "entry" | "page";
  entry_id: string;
  page_id: string | null;
  entry_title: string;
  page_number: number | null;
  label: string;
  snippet: string;
  snippet_parts: Array<{ text: string; highlighted: boolean }>;
  highlight_terms: string[];
  match_count: number;
  query_summary: string | null;
  matched_field: string;
}

export interface CreateEntryInput {
  title: string;
  entry_type: string;
  date_year: number | null;
  date_month: number | null;
  date_day: number | null;
  date_year_uncertain: number;
  date_month_uncertain: number;
  date_day_uncertain: number;
  date_note: string;
  description: string;
  tags: string[];
  notes: string;
}

export interface CreateEntryResult {
  snapshot: ArchiveSnapshot;
  selected_entry_id: string;
  selected_page_id: string | null;
}

export interface ImportEntryPdfInput {
  entry_id: string;
  source_path: string;
  page_start: number | null;
  page_end: number | null;
}

export interface ImportEntryPdfResult {
  snapshot: ArchiveSnapshot;
  selected_page_id: string | null;
}

export interface BatchImportInput {
  source_paths: string[];
}

export interface BatchImportItemResult {
  source_path: string;
  entry_id: string | null;
  selected_page_id: string | null;
  status: "imported" | "failed";
  error: string | null;
}

export interface BatchImportResult {
  snapshot: ArchiveSnapshot;
  imported_count: number;
  failed_count: number;
  results: BatchImportItemResult[];
}

export interface ImportAssetInput {
  entry_id: string;
  source_path: string;
  target_page_id: string | null;
  extraction_mode: "none" | "replace" | "append";
}

export interface ImportAssetResult {
  snapshot: ArchiveSnapshot;
  extraction_status: "none" | "success" | "failed" | "unsupported";
}

export interface PageMutationInput {
  page_id: string;
  target_entry_id: string;
  target_before_page_id: string | null;
}

export interface RemovePageInput {
  page_id: string;
}

export interface PageMutationResult {
  snapshot: ArchiveSnapshot;
  selected_entry_id: string | null;
  selected_page_id: string | null;
}

export interface PageClipboardState {
  mode: "cut" | "copy";
  page_id: string;
}
