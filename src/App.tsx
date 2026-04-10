import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArchiveSnapshot,
  CreateEntryInput,
  EditorTab,
  EntryRecord,
  EntryWithPages,
  ImportAssetInput,
  PageRecord,
  SearchMode,
  SearchResult,
} from "./types";
import {
  createEntry,
  deleteAsset,
  deleteEntry,
  importAsset,
  initArchiveRoot,
  loadBinaryAsset,
  loadArchive,
  searchArchive,
  updateEntry,
  updatePage,
} from "./lib/api";
import { ArchiveSelector } from "./components/ArchiveSelector";
import { CreateEntryDialog } from "./components/CreateEntryDialog";
import { EditorPane } from "./components/EditorPane";
import { NavigationPane } from "./components/NavigationPane";
import { PdfViewerPane } from "./components/PdfViewerPane";
import { ResourceImportDialog, type ResourceImportDialogResult } from "./components/ResourceImportDialog";
import { useI18n } from "./i18n/I18nProvider";
import "./styles.css";

const archiveRootStorageKey = "personal-manuscript-archive:last-root";

interface PendingResourceImport {
  sourcePath: string;
  fileName: string;
  supportsExtraction: boolean;
  hasExistingTranscription: boolean;
}

function supportsAutomaticExtraction(sourcePath: string): boolean {
  const extension = sourcePath.split(".").pop()?.toLowerCase();
  return extension === "txt" || extension === "md" || extension === "docx";
}

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [archiveRoot, setArchiveRoot] = useState<string | null>(
    () => window.localStorage.getItem(archiveRootStorageKey) ?? null,
  );
  const [snapshot, setSnapshot] = useState<ArchiveSnapshot | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [expandedEntryIds, setExpandedEntryIds] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("metadata");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("metadata");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [importingResource, setImportingResource] = useState(false);
  const [pendingResourceImport, setPendingResourceImport] = useState<PendingResourceImport | null>(null);
  const pageIndexLookupRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (archiveRoot) {
      void openArchiveRoot(archiveRoot);
    }
  }, []);

  useEffect(() => {
    if (!archiveRoot || searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchArchive(archiveRoot, searchMode, searchQuery.trim())
        .then((results) => setSearchResults(results))
        .catch((error) => setErrorMessage(String(error)))
        .finally(() => setSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [archiveRoot, searchMode, searchQuery]);

  async function openArchiveRoot(rootPath: string) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await initArchiveRoot(rootPath);
      setSnapshot(nextSnapshot);
      setArchiveRoot(nextSnapshot.archive_root);
      window.localStorage.setItem(archiveRootStorageKey, nextSnapshot.archive_root);
      const firstEntry = nextSnapshot.entries[0] ?? null;
      setSelectedEntryId(firstEntry?.entry.id ?? null);
      setSelectedPageId(firstEntry?.pages[0]?.id ?? null);
      setExpandedEntryIds(firstEntry ? [firstEntry.entry.id] : []);
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function refreshArchive() {
    if (!archiveRoot) {
      return;
    }

    setLoading(true);
    try {
      const nextSnapshot = await loadArchive(archiveRoot);
      setSnapshot(nextSnapshot);
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEntry(input: CreateEntryInput) {
    if (!archiveRoot) {
      return;
    }

    setCreating(true);
    setErrorMessage(null);
    try {
      const result = await createEntry(archiveRoot, input);
      setSnapshot(result.snapshot);
      setSelectedEntryId(result.selected_entry_id);
      setSelectedPageId(result.selected_page_id);
      setExpandedEntryIds((current) =>
        current.includes(result.selected_entry_id) ? current : [...current, result.selected_entry_id],
      );
      setActiveTab("metadata");
      setCreateDialogOpen(false);
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setCreating(false);
    }
  }

  const selectedEntryBundle = useMemo<EntryWithPages | null>(() => {
    if (!snapshot || !selectedEntryId) {
      return null;
    }
    return snapshot.entries.find((item) => item.entry.id === selectedEntryId) ?? null;
  }, [selectedEntryId, snapshot]);

  const selectedPage = useMemo<PageRecord | null>(() => {
    if (!selectedEntryBundle || !selectedPageId) {
      return null;
    }
    return selectedEntryBundle.pages.find((item) => item.id === selectedPageId) ?? null;
  }, [selectedEntryBundle, selectedPageId]);

  const currentPdfPageIndex = selectedPage?.pdf_page_index ?? 0;
  const canonicalPdfPath = selectedEntryBundle?.entry.canonical_pdf_path ?? null;

  useEffect(() => {
    pageIndexLookupRef.current = new Map(
      (selectedEntryBundle?.pages ?? []).map((page) => [page.pdf_page_index, page.id]),
    );
  }, [selectedEntryBundle]);

  useEffect(() => {
    if (!archiveRoot || !canonicalPdfPath) {
      setPdfData(null);
      return;
    }

    let cancelled = false;
    void loadBinaryAsset(archiveRoot, canonicalPdfPath)
      .then((data) => {
        if (!cancelled) {
          setPdfData(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPdfData(null);
          setErrorMessage(String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [archiveRoot, canonicalPdfPath]);

  const handlePdfPageIndexChange = useCallback((pageIndex: number) => {
    const nextPageId = pageIndexLookupRef.current.get(pageIndex) ?? null;
    if (nextPageId) {
      setSelectedPageId(nextPageId);
    }
  }, []);

  function applyUpdatedEntry(updated: EntryRecord) {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        entries: current.entries.map((item) =>
          item.entry.id === updated.id ? { ...item, entry: updated } : item,
        ),
      };
    });
  }

  function applyUpdatedPage(updated: PageRecord) {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        entries: current.entries.map((item) =>
          item.entry.id === updated.entry_id
            ? {
                ...item,
                entry: { ...item.entry, updated_at: updated.updated_at },
                pages: item.pages.map((page) => (page.id === updated.id ? updated : page)),
              }
            : item,
        ),
      };
    });
  }

  async function handleSaveEntry(entry: EntryRecord) {
    if (!archiveRoot) {
      return;
    }
    try {
      const saved = await updateEntry(archiveRoot, entry);
      applyUpdatedEntry(saved);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleSavePage(page: PageRecord) {
    if (!archiveRoot) {
      return;
    }
    try {
      const saved = await updatePage(archiveRoot, page);
      applyUpdatedPage(saved);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleDeleteEntry() {
    if (!archiveRoot || !selectedEntryId) {
      return;
    }

    if (!window.confirm(t("confirm.deleteEntry"))) {
      return;
    }

    try {
      const nextSnapshot = await deleteEntry(archiveRoot, selectedEntryId);
      setSnapshot(nextSnapshot);
      const firstEntry = nextSnapshot.entries[0] ?? null;
      setSelectedEntryId(firstEntry?.entry.id ?? null);
      setSelectedPageId(firstEntry?.pages[0]?.id ?? null);
      setExpandedEntryIds(firstEntry ? [firstEntry.entry.id] : []);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleImportResource(sourcePath: string) {
    const fileName = sourcePath.split(/[\\/]/).pop() || sourcePath;
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingResourceImport({
      sourcePath,
      fileName,
      supportsExtraction: supportsAutomaticExtraction(sourcePath),
      hasExistingTranscription: Boolean(selectedPage?.transcription_text?.trim()),
    });
  }

  async function handleConfirmResourceImport(result: ResourceImportDialogResult) {
    if (!archiveRoot || !selectedEntryBundle || !pendingResourceImport) {
      return;
    }

    let extractionMode: ImportAssetInput["extraction_mode"] = "none";
    if (result.importMode === "resource_and_extract") {
      if (pendingResourceImport.hasExistingTranscription) {
        extractionMode = result.existingTranscriptionMode === "cancel" ? "none" : result.existingTranscriptionMode;
      } else {
        extractionMode = "replace";
      }
    }

    setImportingResource(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await importAsset(archiveRoot, {
        entry_id: selectedEntryBundle.entry.id,
        source_path: pendingResourceImport.sourcePath,
        target_page_id: extractionMode === "none" ? null : selectedPage?.id ?? null,
        extraction_mode: extractionMode,
      });

      setSnapshot(response.snapshot);
      setPendingResourceImport(null);

      if (response.extraction_status === "success") {
        setStatusMessage(t("notice.extractionSuccess"));
      } else if (response.extraction_status === "failed") {
        setErrorMessage(t("notice.extractionFailed"));
      } else if (response.extraction_status === "unsupported") {
        setErrorMessage(t("notice.extractionUnsupported"));
      }
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setImportingResource(false);
    }
  }

  async function handleDeleteResource(assetId: string) {
    if (!archiveRoot) {
      return;
    }

    try {
      const nextSnapshot = await deleteAsset(archiveRoot, assetId);
      setSnapshot(nextSnapshot);
      setStatusMessage(null);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  if (!archiveRoot || !snapshot) {
    return (
      <ArchiveSelector
        archiveRoot={archiveRoot}
        onChooseRoot={openArchiveRoot}
        loading={loading}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("app.desktopArchive")}</p>
          <h1>{t("app.name")}</h1>
        </div>
        <div className="topbar-meta">
          <label className="language-selector">
            <span>{t("app.language")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as "zh-TW" | "en" | "de")}>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <span>{archiveRoot}</span>
          {statusMessage ? <span className="info-chip">{statusMessage}</span> : null}
          {errorMessage ? <span className="error-chip">{errorMessage}</span> : null}
        </div>
      </header>

      <section className="workspace-grid">
        <NavigationPane
          entries={snapshot.entries}
          selectedEntryId={selectedEntryId}
          selectedPageId={selectedPageId}
          expandedEntryIds={expandedEntryIds}
          searchQuery={searchQuery}
          searchMode={searchMode}
          searchResults={searchResults}
          onSearchQueryChange={setSearchQuery}
          onSearchModeChange={setSearchMode}
          onSelectEntry={(entryId) => {
            setSelectedEntryId(entryId);
            const entry = snapshot.entries.find((item) => item.entry.id === entryId);
            setSelectedPageId(entry?.pages[0]?.id ?? null);
            setExpandedEntryIds((current) => (current.includes(entryId) ? current : [...current, entryId]));
            setActiveTab("metadata");
          }}
          onSelectPage={(page) => {
            setSelectedEntryId(page.entry_id);
            setSelectedPageId(page.id);
            setExpandedEntryIds((current) =>
              current.includes(page.entry_id) ? current : [...current, page.entry_id],
            );
          }}
          onToggleEntry={(entryId) =>
            setExpandedEntryIds((current) =>
              current.includes(entryId)
                ? current.filter((item) => item !== entryId)
                : [...current, entryId],
            )
          }
          onOpenCreateDialog={() => setCreateDialogOpen(true)}
          onDeleteEntry={handleDeleteEntry}
          onRefresh={refreshArchive}
          searching={searching}
        />
        <PdfViewerPane
          pdfData={pdfData}
          currentPageIndex={currentPdfPageIndex}
          pageCount={selectedEntryBundle?.entry.page_count ?? 0}
          onPageIndexChange={handlePdfPageIndexChange}
        />
        <EditorPane
          entry={selectedEntryBundle?.entry ?? null}
          page={selectedPage}
          assets={selectedEntryBundle?.assets ?? []}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSaveEntry={handleSaveEntry}
          onSavePage={handleSavePage}
          onImportResource={handleImportResource}
          onDeleteResource={(asset) => handleDeleteResource(asset.id)}
          importingResource={importingResource}
        />
      </section>

      <CreateEntryDialog
        openState={createDialogOpen}
        creating={creating}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateEntry}
      />
      <ResourceImportDialog
        openState={Boolean(pendingResourceImport)}
        fileName={pendingResourceImport?.fileName ?? ""}
        supportsExtraction={pendingResourceImport?.supportsExtraction ?? false}
        hasExistingTranscription={pendingResourceImport?.hasExistingTranscription ?? false}
        submitting={importingResource}
        onClose={() => setPendingResourceImport(null)}
        onSubmit={handleConfirmResourceImport}
      />
    </main>
  );
}
