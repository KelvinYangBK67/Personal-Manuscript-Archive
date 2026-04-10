export type SearchMode = "metadata" | "full_text";
export type EditorTab = "metadata" | "transcription" | "resources";

export interface EntryRecord {
  id: string;
  title: string;
  entry_type: string | null;
  date_from: string | null;
  date_to: string | null;
  date_precision: string | null;
  description: string | null;
  language_or_system: string | null;
  tags_json: string | null;
  source_form: string | null;
  canonical_pdf_path: string | null;
  page_count: number;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageRecord {
  id: string;
  entry_id: string;
  page_number: number | null;
  page_label: string | null;
  pdf_page_index: number;
  transcription_text: string | null;
  summary: string | null;
  keywords_json: string | null;
  transcription_status: string | null;
  contains_special_glyphs: number;
  special_glyph_note: string | null;
  legibility: string | null;
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
  matched_field: string;
}

export interface CreateEntryInput {
  title: string;
  entry_type: string;
  date_from: string;
  date_to: string;
  date_precision: string;
  description: string;
  language_or_system: string;
  tags: string[];
  source_form: string;
  status: string;
  notes: string;
  canonical_pdf_source: string;
}

export interface CreateEntryResult {
  snapshot: ArchiveSnapshot;
  selected_entry_id: string;
  selected_page_id: string | null;
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
