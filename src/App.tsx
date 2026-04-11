import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArchiveSnapshot,
  CreateEntryInput,
  EditorTab,
  EntryRecord,
  EntryWithPages,
  ImportAssetInput,
  PageClipboardState,
  PageRecord,
  SearchMode,
  SearchResult,
} from "./types";
import {
  copyPage,
  createEntry,
  deleteAsset,
  deleteEntry,
  importAsset,
  importEntryPdf,
  initArchiveRoot,
  loadBinaryAsset,
  loadArchive,
  movePage,
  removePage,
  searchArchive,
  updateEntry,
  updatePage,
} from "./lib/api";
import { ArchiveSelector } from "./components/ArchiveSelector";
import { CreateEntryDialog } from "./components/CreateEntryDialog";
import { EditorPane } from "./components/EditorPane";
import { NavigationPane, buildTreeNodeIds } from "./components/NavigationPane";
import { PdfViewerPane } from "./components/PdfViewerPane";
import { ResourceImportDialog, type ResourceImportDialogResult } from "./components/ResourceImportDialog";
import { comparePagesBySortOrder } from "./lib/utils";
import { useI18n } from "./i18n/I18nProvider";
import "./styles.css";

const archiveRootStorageKey = "personal-manuscript-archive:last-root";

interface PendingResourceImport {
  sourcePath: string;
  fileName: string;
  supportsExtraction: boolean;
  hasExistingTranscription: boolean;
}

interface PendingPdfImport {
  sourcePath: string;
  pageStart: number | null;
  pageEnd: number | null;
}

function supportsAutomaticExtraction(sourcePath: string): boolean {
  const extension = sourcePath.split(".").pop()?.toLowerCase();
  return extension === "txt" || extension === "md" || extension === "docx" || extension === "tex";
}

function resolvePdfPageIndex(page: PageRecord): number {
  if (page.original_page_number != null && page.original_page_number > 0) {
    return page.original_page_number - 1;
  }
  if (page.page_number != null && page.page_number > 0) {
    return page.page_number - 1;
  }
  if (page.source_pdf_page_index > 0) {
    return page.source_pdf_page_index;
  }
  if (page.sort_order > 0) {
    return page.sort_order - 1;
  }
  return 0;
}

function getDefaultExpandedNodeIds(entryBundle: EntryWithPages | null): string[] {
  if (!entryBundle) {
    return [];
  }
  const ids = buildTreeNodeIds(entryBundle.entry);
  return [ids.typeId, ids.entryId, "yearId" in ids ? ids.yearId : ids.unknownId, "monthId" in ids ? ids.monthId ?? null : null].filter(
    (value): value is string => Boolean(value),
  );
}

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [archiveRoot, setArchiveRoot] = useState<string | null>(
    () => window.localStorage.getItem(archiveRootStorageKey) ?? null,
  );
  const [snapshot, setSnapshot] = useState<ArchiveSnapshot | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
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
  const [pageClipboard, setPageClipboard] = useState<PageClipboardState | null>(null);
  const pageIndexLookupRef = useRef<Map<number, string>>(new Map());
  const pdfCacheRef = useRef<Map<string, Uint8Array>>(new Map());

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
    }, 220);

    return () => window.clearTimeout(timer);
  }, [archiveRoot, searchMode, searchQuery]);

  async function openArchiveRoot(rootPath: string) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await initArchiveRoot(rootPath);
      const firstEntry = nextSnapshot.entries[0] ?? null;
      setSnapshot(nextSnapshot);
      setArchiveRoot(nextSnapshot.archive_root);
      window.localStorage.setItem(archiveRootStorageKey, nextSnapshot.archive_root);
      setSelectedEntryId(firstEntry?.entry.id ?? null);
      setSelectedPageId((firstEntry ? [...firstEntry.pages].sort(comparePagesBySortOrder)[0] : null)?.id ?? null);
      setExpandedNodeIds(getDefaultExpandedNodeIds(firstEntry));
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
      setSnapshot(await loadArchive(archiveRoot));
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  function findEntryBundle(entries: EntryWithPages[], entryId: string | null): EntryWithPages | null {
    if (!entryId) {
      return null;
    }
    return entries.find((item) => item.entry.id === entryId) ?? null;
  }

  async function handleCreateEntry(input: CreateEntryInput) {
    if (!archiveRoot) {
      return;
    }
    setCreating(true);
    setErrorMessage(null);
    try {
      const result = await createEntry(archiveRoot, input);
      const selectedBundle = result.snapshot.entries.find((item) => item.entry.id === result.selected_entry_id) ?? null;
      setSnapshot(result.snapshot);
      setSelectedEntryId(result.selected_entry_id);
      setSelectedPageId(result.selected_page_id);
      setExpandedNodeIds((current) => [...new Set([...current, ...getDefaultExpandedNodeIds(selectedBundle)])]);
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

  const currentPdfPath = selectedPage?.source_pdf_path ?? null;
  const currentPdfPages = useMemo(
    () =>
      [...(selectedEntryBundle?.pages ?? [])]
        .filter((page) => page.source_pdf_path === currentPdfPath)
        .sort((a, b) => resolvePdfPageIndex(a) - resolvePdfPageIndex(b)),
    [currentPdfPath, selectedEntryBundle],
  );
  const currentPdfPageIndex = selectedPage ? resolvePdfPageIndex(selectedPage) : 0;
  const currentPdfPageCount = useMemo(() => {
    if (currentPdfPages.length === 0) {
      return 0;
    }
    return Math.max(...currentPdfPages.map((page) => resolvePdfPageIndex(page))) + 1;
  }, [currentPdfPages]);

  useEffect(() => {
    pageIndexLookupRef.current = new Map(currentPdfPages.map((page) => [resolvePdfPageIndex(page), page.id]));
  }, [currentPdfPages]);

  useEffect(() => {
    if (!archiveRoot || !currentPdfPath) {
      setPdfData(null);
      return;
    }
    let cancelled = false;
    const cached = pdfCacheRef.current.get(currentPdfPath);
    if (cached) {
      setPdfData(new Uint8Array(cached));
      return;
    }
    setPdfData(null);
    void loadBinaryAsset(archiveRoot, currentPdfPath)
      .then((data) => {
        if (!cancelled) {
          if (data) {
            pdfCacheRef.current.set(currentPdfPath, new Uint8Array(data));
            setPdfData(new Uint8Array(data));
          } else {
            setPdfData(null);
          }
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
  }, [archiveRoot, currentPdfPath]);

  const handlePdfPageIndexChange = useCallback((pageIndex: number) => {
    const nextPageId = pageIndexLookupRef.current.get(pageIndex) ?? null;
    if (nextPageId) {
      setSelectedPageId(nextPageId);
    }
  }, []);

  function applyUpdatedEntry(updated: EntryRecord) {
    setSnapshot((current) =>
      current
        ? { ...current, entries: current.entries.map((item) => (item.entry.id === updated.id ? { ...item, entry: updated } : item)) }
        : current,
    );
  }

  function applyUpdatedPage(updated: PageRecord) {
    setSnapshot((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((item) =>
              item.entry.id === updated.entry_id
                ? {
                    ...item,
                    entry: { ...item.entry, updated_at: updated.updated_at },
                    pages: item.pages.map((page) => (page.id === updated.id ? updated : page)).sort(comparePagesBySortOrder),
                  }
                : item,
            ),
          }
        : current,
    );
  }

  async function handleSaveEntry(entryRecord: EntryRecord) {
    if (!archiveRoot) {
      return;
    }
    try {
      applyUpdatedEntry(await updateEntry(archiveRoot, entryRecord));
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleSavePage(pageRecord: PageRecord) {
    if (!archiveRoot) {
      return;
    }
    try {
      applyUpdatedPage(await updatePage(archiveRoot, pageRecord));
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
      const firstEntry = nextSnapshot.entries[0] ?? null;
      setSnapshot(nextSnapshot);
      setSelectedEntryId(firstEntry?.entry.id ?? null);
      setSelectedPageId((firstEntry ? [...firstEntry.pages].sort(comparePagesBySortOrder)[0] : null)?.id ?? null);
      setExpandedNodeIds(getDefaultExpandedNodeIds(firstEntry));
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
      extractionMode = pendingResourceImport.hasExistingTranscription
        ? result.existingTranscriptionMode === "cancel"
          ? "none"
          : result.existingTranscriptionMode
        : "replace";
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

  async function handleImportPdfPages(input: PendingPdfImport) {
    if (!archiveRoot || !selectedEntryBundle) {
      return;
    }
    setImportingResource(true);
    setErrorMessage(null);
    try {
      const result = await importEntryPdf(archiveRoot, {
        entry_id: selectedEntryBundle.entry.id,
        source_path: input.sourcePath,
        page_start: input.pageStart,
        page_end: input.pageEnd,
      });
      setSnapshot(result.snapshot);
      setSelectedPageId(result.selected_page_id);
      setExpandedNodeIds((current) => [...new Set([...current, ...getDefaultExpandedNodeIds(selectedEntryBundle)])]);
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
      setSnapshot(await deleteAsset(archiveRoot, assetId));
      setStatusMessage(null);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleMovePage(pageId: string, targetEntryId: string, targetBeforePageId: string | null) {
    if (!archiveRoot) {
      return;
    }
    try {
      const result = await movePage(archiveRoot, {
        page_id: pageId,
        target_entry_id: targetEntryId,
        target_before_page_id: targetBeforePageId,
      });
      const selectedBundle = findEntryBundle(result.snapshot.entries, result.selected_entry_id);
      setSnapshot(result.snapshot);
      setSelectedEntryId(result.selected_entry_id);
      setSelectedPageId(result.selected_page_id);
      ensureExpandedForEntry(selectedBundle);
      if (pageClipboard?.mode === "cut" && pageClipboard.page_id === pageId) {
        setPageClipboard(null);
      }
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handlePasteIntoEntry(entryId: string, targetBeforePageId: string | null) {
    if (!archiveRoot || !pageClipboard) {
      return;
    }
    try {
      const result =
        pageClipboard.mode === "cut"
          ? await movePage(archiveRoot, {
              page_id: pageClipboard.page_id,
              target_entry_id: entryId,
              target_before_page_id: targetBeforePageId,
            })
          : await copyPage(archiveRoot, {
              page_id: pageClipboard.page_id,
              target_entry_id: entryId,
              target_before_page_id: targetBeforePageId,
            });
      const selectedBundle = findEntryBundle(result.snapshot.entries, result.selected_entry_id);
      setSnapshot(result.snapshot);
      setSelectedEntryId(result.selected_entry_id);
      setSelectedPageId(result.selected_page_id);
      ensureExpandedForEntry(selectedBundle);
      if (pageClipboard.mode === "cut") {
        setPageClipboard(null);
      }
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function handleRemovePage(pageId: string) {
    if (!archiveRoot || !window.confirm(t("confirm.removePage"))) {
      return;
    }
    try {
      const result = await removePage(archiveRoot, { page_id: pageId });
      const selectedBundle = findEntryBundle(result.snapshot.entries, result.selected_entry_id);
      setSnapshot(result.snapshot);
      setSelectedEntryId(result.selected_entry_id);
      setSelectedPageId(result.selected_page_id);
      ensureExpandedForEntry(selectedBundle);
      if (pageClipboard?.page_id === pageId) {
        setPageClipboard(null);
      }
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  function ensureExpandedForEntry(entryBundle: EntryWithPages | null) {
    if (!entryBundle) {
      return;
    }
    setExpandedNodeIds((current) => [...new Set([...current, ...getDefaultExpandedNodeIds(entryBundle)])]);
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
          expandedNodeIds={expandedNodeIds}
          searchQuery={searchQuery}
          searchMode={searchMode}
          searchResults={searchResults}
          pageClipboard={pageClipboard}
          onSearchQueryChange={setSearchQuery}
          onSearchModeChange={setSearchMode}
          onSelectEntry={(entryId) => {
            const entryBundle = snapshot.entries.find((item) => item.entry.id === entryId) ?? null;
            setSelectedEntryId(entryId);
            setSelectedPageId((entryBundle ? [...entryBundle.pages].sort(comparePagesBySortOrder)[0] : null)?.id ?? null);
            ensureExpandedForEntry(entryBundle);
            setActiveTab("metadata");
          }}
          onSelectPage={(page) => {
            const entryBundle = snapshot.entries.find((item) => item.entry.id === page.entry_id) ?? null;
            setSelectedEntryId(page.entry_id);
            setSelectedPageId(page.id);
            ensureExpandedForEntry(entryBundle);
          }}
          onToggleNode={(nodeId) =>
            setExpandedNodeIds((current) =>
              current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId],
            )
          }
          onOpenCreateDialog={() => setCreateDialogOpen(true)}
          onDeleteEntry={handleDeleteEntry}
          onRefresh={refreshArchive}
          onMovePage={handleMovePage}
          onCopyPage={(pageId) => setPageClipboard({ mode: "copy", page_id: pageId })}
          onCutPage={(pageId) => setPageClipboard({ mode: "cut", page_id: pageId })}
          onPasteIntoEntry={handlePasteIntoEntry}
          onRemovePage={handleRemovePage}
          searching={searching}
        />

        <PdfViewerPane
          sourceKey={currentPdfPath ?? ""}
          pdfData={pdfData}
          currentPageIndex={currentPdfPageIndex}
          pageCount={currentPdfPageCount}
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
          onImportPdfPages={handleImportPdfPages}
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
