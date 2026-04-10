import { invoke } from "@tauri-apps/api/core";
import type {
  ArchiveSnapshot,
  CreateEntryInput,
  CreateEntryResult,
  EntryRecord,
  ImportAssetInput,
  ImportAssetResult,
  ImportEntryPdfInput,
  ImportEntryPdfResult,
  PageMutationInput,
  PageMutationResult,
  PageRecord,
  RemovePageInput,
  SearchMode,
  SearchResult,
} from "../types";

export async function initArchiveRoot(rootPath: string): Promise<ArchiveSnapshot> {
  return invoke("init_archive_root", { rootPath });
}

export async function loadArchive(rootPath: string): Promise<ArchiveSnapshot> {
  return invoke("load_archive", { rootPath });
}

export async function createEntry(rootPath: string, input: CreateEntryInput): Promise<CreateEntryResult> {
  return invoke("create_entry", { rootPath, input });
}

export async function importEntryPdf(rootPath: string, input: ImportEntryPdfInput): Promise<ImportEntryPdfResult> {
  return invoke("import_entry_pdf", { rootPath, input });
}

export async function updateEntry(rootPath: string, entry: EntryRecord): Promise<EntryRecord> {
  return invoke("update_entry", { rootPath, entry });
}

export async function updatePage(rootPath: string, page: PageRecord): Promise<PageRecord> {
  return invoke("update_page", { rootPath, page });
}

export async function searchArchive(
  rootPath: string,
  mode: SearchMode,
  query: string,
): Promise<SearchResult[]> {
  return invoke("search_archive", { rootPath, mode, query });
}

export async function deleteEntry(rootPath: string, entryId: string): Promise<ArchiveSnapshot> {
  return invoke("delete_entry", { rootPath, entryId });
}

export async function loadBinaryAsset(rootPath: string, relativePath: string | null): Promise<Uint8Array | null> {
  if (!relativePath) {
    return null;
  }

  const payload = await invoke<{ bytes: number[] }>("load_binary_asset", {
    rootPath,
    relativePath,
  });

  return new Uint8Array(payload.bytes);
}

export async function importAsset(rootPath: string, input: ImportAssetInput): Promise<ImportAssetResult> {
  return invoke("import_asset", { rootPath, input });
}

export async function deleteAsset(rootPath: string, assetId: string): Promise<ArchiveSnapshot> {
  return invoke("delete_asset", { rootPath, assetId });
}

export async function movePage(rootPath: string, input: PageMutationInput): Promise<PageMutationResult> {
  return invoke("move_page", { rootPath, input });
}

export async function copyPage(rootPath: string, input: PageMutationInput): Promise<PageMutationResult> {
  return invoke("copy_page", { rootPath, input });
}

export async function removePage(rootPath: string, input: RemovePageInput): Promise<PageMutationResult> {
  return invoke("remove_page", { rootPath, input });
}
