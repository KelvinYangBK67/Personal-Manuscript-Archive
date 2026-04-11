import { useEffect, useMemo, useState, type DragEvent } from "react";
import type {
  EntryRecord,
  EntryWithPages,
  PageClipboardState,
  PageRecord,
  SearchMode,
  SearchResult,
} from "../types";
import { compareEntriesByStructuredDate, comparePagesBySortOrder, formatPageLabel } from "../lib/utils";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

interface NavigationPaneProps {
  entries: EntryWithPages[];
  selectedEntryId: string | null;
  selectedPageId: string | null;
  expandedNodeIds: string[];
  searchQuery: string;
  searchMode: SearchMode;
  searchResults: SearchResult[];
  pageClipboard: PageClipboardState | null;
  onSearchQueryChange: (value: string) => void;
  onSearchModeChange: (value: SearchMode) => void;
  onSelectEntry: (entryId: string) => void;
  onSelectPage: (page: PageRecord) => void;
  onToggleNode: (nodeId: string) => void;
  onOpenCreateDialog: () => void;
  onDeleteEntry: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onMovePage: (pageId: string, targetEntryId: string, targetBeforePageId: string | null) => Promise<void>;
  onCopyPage: (pageId: string) => void;
  onCutPage: (pageId: string) => void;
  onPasteIntoEntry: (entryId: string, targetBeforePageId: string | null) => Promise<void>;
  onRemovePage: (pageId: string) => Promise<void>;
  searching: boolean;
}

interface TreePageNode {
  id: string;
  page: PageRecord;
}

interface TreeEntryNode {
  id: string;
  entry: EntryWithPages;
  pages: TreePageNode[];
}

interface TreeMonthNode {
  id: string;
  label: string;
  entries: TreeEntryNode[];
}

interface TreeYearNode {
  id: string;
  label: string;
  months: TreeMonthNode[];
  directEntries: TreeEntryNode[];
}

interface TreeTypeNode {
  id: string;
  label: string;
  years: TreeYearNode[];
  unknownEntries: TreeEntryNode[];
}

interface ContextMenuState {
  x: number;
  y: number;
  pageId?: string;
  entryId?: string;
}

function getEntryTypeLabel(entry: EntryRecord): string {
  const value = entry.entry_type?.trim();
  return value || "Uncategorized";
}

export function buildTreeNodeIds(entry: EntryRecord) {
  const typeLabel = getEntryTypeLabel(entry);
  const typeId = `type:${typeLabel}`;
  const yearKnown = entry.date_year !== null && entry.date_year_uncertain === 0;

  if (!yearKnown) {
    return {
      typeId,
      unknownId: `${typeId}:unknown`,
      entryId: `entry:${entry.id}`,
    };
  }

  const yearId = `${typeId}:year:${entry.date_year}`;
  const monthKnown = entry.date_month !== null && entry.date_month_uncertain === 0;
  const monthId = monthKnown ? `${yearId}:month:${String(entry.date_month).padStart(2, "0")}` : null;

  return {
    typeId,
    yearId,
    monthId,
    entryId: `entry:${entry.id}`,
  };
}

function sortTypeLabels(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function NavigationPane(props: NavigationPaneProps) {
  const { t } = useI18n();
  const {
    entries,
    selectedEntryId,
    selectedPageId,
    expandedNodeIds,
    searchQuery,
    searchMode,
    searchResults,
    pageClipboard,
    onSearchQueryChange,
    onSearchModeChange,
    onSelectEntry,
    onSelectPage,
    onToggleNode,
    onOpenCreateDialog,
    onDeleteEntry,
    onRefresh,
    onMovePage,
    onCopyPage,
    onCutPage,
    onPasteIntoEntry,
    onRemovePage,
    searching,
  } = props;

  const expandedSet = useMemo(() => new Set(expandedNodeIds), [expandedNodeIds]);
  const showingResults = searchQuery.trim().length > 0;
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function handleWindowClick() {
      setContextMenu(null);
    }

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [contextMenu]);

  const tree = useMemo<TreeTypeNode[]>(() => {
    const grouped = new Map<string, TreeTypeNode>();

    for (const entryBundle of [...entries].sort((a, b) => compareEntriesByStructuredDate(a.entry, b.entry))) {
      const typeLabel = getEntryTypeLabel(entryBundle.entry);
      let typeNode = grouped.get(typeLabel);
      if (!typeNode) {
        typeNode = {
          id: `type:${typeLabel}`,
          label: typeLabel,
          years: [],
          unknownEntries: [],
        };
        grouped.set(typeLabel, typeNode);
      }

      const entryNode: TreeEntryNode = {
        id: `entry:${entryBundle.entry.id}`,
        entry: entryBundle,
        pages: [...entryBundle.pages]
          .sort(comparePagesBySortOrder)
          .map((page) => ({ id: `page:${page.id}`, page })),
      };

      const yearKnown = entryBundle.entry.date_year !== null && entryBundle.entry.date_year_uncertain === 0;
      if (!yearKnown) {
        typeNode.unknownEntries.push(entryNode);
        continue;
      }

      const yearLabel = String(entryBundle.entry.date_year);
      let yearNode = typeNode.years.find((item) => item.label === yearLabel);
      if (!yearNode) {
        yearNode = {
          id: `${typeNode.id}:year:${yearLabel}`,
          label: yearLabel,
          months: [],
          directEntries: [],
        };
        typeNode.years.push(yearNode);
      }

      const monthKnown = entryBundle.entry.date_month !== null && entryBundle.entry.date_month_uncertain === 0;
      if (!monthKnown) {
        yearNode.directEntries.push(entryNode);
        continue;
      }

      const monthLabel = `${yearLabel}-${String(entryBundle.entry.date_month).padStart(2, "0")}`;
      let monthNode = yearNode.months.find((item) => item.label === monthLabel);
      if (!monthNode) {
        monthNode = {
          id: `${yearNode.id}:month:${String(entryBundle.entry.date_month).padStart(2, "0")}`,
          label: monthLabel,
          entries: [],
        };
        yearNode.months.push(monthNode);
      }
      monthNode.entries.push(entryNode);
    }

    return [...grouped.values()]
      .sort((a, b) => sortTypeLabels(a.label, b.label))
      .map((typeNode) => ({
        ...typeNode,
        years: [...typeNode.years]
          .sort((a, b) => Number(a.label) - Number(b.label))
          .map((yearNode) => ({
            ...yearNode,
            months: [...yearNode.months].sort((a, b) => a.label.localeCompare(b.label)),
            directEntries: [...yearNode.directEntries].sort((a, b) =>
              compareEntriesByStructuredDate(a.entry.entry, b.entry.entry),
            ),
          })),
        unknownEntries: [...typeNode.unknownEntries].sort((a, b) =>
          compareEntriesByStructuredDate(a.entry.entry, b.entry.entry),
        ),
      }));
  }, [entries]);

  function matchedFieldKey(field: string): TranslationKey {
    const fieldMap: Record<string, TranslationKey> = {
      title: "result.matchedField.title",
      description: "result.matchedField.description",
      entry_type: "result.matchedField.entry_type",
      tags_json: "result.matchedField.tags_json",
      summary: "result.matchedField.summary",
      keywords_json: "result.matchedField.keywords_json",
      page_notes: "result.matchedField.page_notes",
      transcription_text: "result.matchedField.transcription_text",
    };

    return fieldMap[field] ?? "result.matchedField.description";
  }

  function handlePageDragStart(event: DragEvent<HTMLButtonElement>, pageId: string) {
    event.dataTransfer.setData("application/x-page-id", pageId);
    event.dataTransfer.effectAllowed = "move";
  }

  function readDraggedPageId(event: DragEvent<HTMLElement>): string | null {
    return event.dataTransfer.getData("application/x-page-id") || null;
  }

  function handlePageDrop(event: DragEvent<HTMLElement>, targetEntryId: string, targetBeforePageId: string | null) {
    event.preventDefault();
    const pageId = readDraggedPageId(event);
    setDragTarget(null);
    if (!pageId || pageId === targetBeforePageId) {
      return;
    }
    void onMovePage(pageId, targetEntryId, targetBeforePageId);
  }

  function renderContextMenu() {
    if (!contextMenu) {
      return null;
    }

    return (
      <div className="tree-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        {contextMenu.pageId ? (
          <>
            <button
              className="tree-context-item"
              onClick={() => {
                onCutPage(contextMenu.pageId!);
                setContextMenu(null);
              }}
            >
              {t("pageAction.cut")}
            </button>
            <button
              className="tree-context-item"
              onClick={() => {
                onCopyPage(contextMenu.pageId!);
                setContextMenu(null);
              }}
            >
              {t("pageAction.copy")}
            </button>
            <button
              className="tree-context-item danger"
              onClick={() => {
                void onRemovePage(contextMenu.pageId!);
                setContextMenu(null);
              }}
            >
              {t("pageAction.remove")}
            </button>
          </>
        ) : null}
        {contextMenu.entryId ? (
          <button
            className="tree-context-item"
            disabled={!pageClipboard}
            onClick={() => {
              void onPasteIntoEntry(contextMenu.entryId!, null);
              setContextMenu(null);
            }}
          >
            {t("pageAction.pasteIntoEntry")}
          </button>
        ) : null}
      </div>
    );
  }

  function renderEntryNode(node: TreeEntryNode) {
    const expanded = expandedSet.has(node.id);
    return (
      <div key={node.id} className="tree-node tree-entry-node">
        <div className="tree-row">
          <button className="tree-toggle-button" onClick={() => onToggleNode(node.id)} aria-label="toggle">
            {expanded ? "▾" : "▸"}
          </button>
          <button
            className={`tree-label-button tree-entry-label ${selectedEntryId === node.entry.entry.id ? "is-active" : ""} ${
              dragTarget === node.id ? "is-drop-target" : ""
            }`}
            onClick={() => onSelectEntry(node.entry.entry.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, entryId: node.entry.entry.id });
            }}
            onDragOver={(event) => {
              if (readDraggedPageId(event)) {
                event.preventDefault();
                setDragTarget(node.id);
              }
            }}
            onDragLeave={() => setDragTarget((current) => (current === node.id ? null : current))}
            onDrop={(event) => handlePageDrop(event, node.entry.entry.id, null)}
          >
            {node.entry.entry.title}
          </button>
        </div>
        {expanded ? (
          <div className="tree-children">
            {node.pages.map((pageNode) => (
              <div key={pageNode.id} className="tree-row tree-page-row">
                <button
                  className="tree-drag-handle"
                  draggable
                  aria-label={t("pageAction.drag")}
                  title={t("pageAction.drag")}
                  onDragStart={(event) => handlePageDragStart(event, pageNode.page.id)}
                >
                  ≡
                </button>
                <button
                  className={`tree-label-button tree-page-label ${selectedPageId === pageNode.page.id ? "is-active" : ""} ${
                    dragTarget === pageNode.id ? "is-drop-target" : ""
                  } ${pageClipboard?.page_id === pageNode.page.id ? "is-clipboard-source" : ""}`}
                  onClick={() => onSelectPage(pageNode.page)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, pageId: pageNode.page.id });
                  }}
                  onDragOver={(event) => {
                    if (readDraggedPageId(event)) {
                      event.preventDefault();
                      setDragTarget(pageNode.id);
                    }
                  }}
                  onDragLeave={() => setDragTarget((current) => (current === pageNode.id ? null : current))}
                  onDrop={(event) => handlePageDrop(event, node.entry.entry.id, pageNode.page.id)}
                >
                  {formatPageLabel(
                    pageNode.page.page_number,
                    pageNode.page.page_label,
                    t("common.page"),
                    t("common.untitledPage"),
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="pane pane-nav">
      <div className="pane-toolbar pane-toolbar-stacked nav-toolbar">
        <div className="search-stack">
          <input
            className="search-input"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("nav.searchPlaceholder")}
          />
          <select
            className="search-select"
            value={searchMode}
            onChange={(event) => onSearchModeChange(event.target.value as SearchMode)}
          >
            <option value="metadata">{t("nav.metadataSearch")}</option>
            <option value="full_text">{t("nav.fullTextSearch")}</option>
          </select>
          <p className="search-syntax-hint">{t("nav.searchSyntaxHint")}</p>
        </div>
        <div className="action-row compact-actions">
          <button className="primary-button compact-button" onClick={onOpenCreateDialog}>
            {t("nav.newEntry")}
          </button>
          <button className="secondary-button compact-button" onClick={() => void onRefresh()}>
            {t("common.refresh")}
          </button>
          <button className="ghost-button compact-button" onClick={() => void onDeleteEntry()} disabled={!selectedEntryId}>
            {t("nav.deleteEntry")}
          </button>
        </div>
      </div>

      <div className="nav-content">
        {showingResults ? (
          <section className="search-results">
            <div className="section-heading">
              <h3>{t("nav.results")}</h3>
              <span>{searching ? t("common.searching") : t("nav.matches", { count: searchResults.length })}</span>
            </div>
            {searchResults.map((result) => (
              <button
                key={`${result.result_type}-${result.page_id ?? result.entry_id}-${result.matched_field}`}
                className="search-result-card"
                onClick={() => {
                  if (result.page_id) {
                    const entry = entries.find((item) => item.entry.id === result.entry_id);
                    const page = entry?.pages.find((item) => item.id === result.page_id);
                    if (page) {
                      onSelectPage(page);
                      return;
                    }
                  }
                  onSelectEntry(result.entry_id);
                }}
              >
                <strong>{result.label}</strong>
                <span className="search-result-meta">
                  {result.result_type === "page" ? t("nav.pageResult") : t("nav.entryResult")} -{" "}
                  {t(matchedFieldKey(result.matched_field))}
                </span>
                <p>
                  {result.snippet_parts?.length
                    ? result.snippet_parts.map((part, index) =>
                        part.highlighted ? (
                          <mark key={`${result.entry_id}-${result.page_id ?? "entry"}-${index}`} className="search-highlight">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={`${result.entry_id}-${result.page_id ?? "entry"}-${index}`}>{part.text}</span>
                        ),
                      )
                    : result.snippet}
                </p>
              </button>
            ))}
          </section>
        ) : tree.length > 0 ? (
          <div className="outline-tree">
            {tree.map((typeNode) => {
              const typeExpanded = expandedSet.has(typeNode.id);
              return (
                <div key={typeNode.id} className="tree-node tree-type-node">
                  <div className="tree-row">
                    <button className="tree-toggle-button" onClick={() => onToggleNode(typeNode.id)} aria-label="toggle">
                      {typeExpanded ? "▾" : "▸"}
                    </button>
                    <button className="tree-label-button tree-type-label" onClick={() => onToggleNode(typeNode.id)}>
                      {typeNode.label}
                    </button>
                  </div>
                  {typeExpanded ? (
                    <div className="tree-children">
                      {typeNode.years.map((yearNode) => {
                        const yearExpanded = expandedSet.has(yearNode.id);
                        return (
                          <div key={yearNode.id} className="tree-node tree-year-node">
                            <div className="tree-row">
                              <button
                                className="tree-toggle-button"
                                onClick={() => onToggleNode(yearNode.id)}
                                aria-label="toggle"
                              >
                                {yearExpanded ? "▾" : "▸"}
                              </button>
                              <button className="tree-label-button tree-year-label" onClick={() => onToggleNode(yearNode.id)}>
                                {yearNode.label}
                              </button>
                            </div>
                            {yearExpanded ? (
                              <div className="tree-children">
                                {yearNode.directEntries.map((entryNode) => renderEntryNode(entryNode))}
                                {yearNode.months.map((monthNode) => {
                                  const monthExpanded = expandedSet.has(monthNode.id);
                                  return (
                                    <div key={monthNode.id} className="tree-node tree-month-node">
                                      <div className="tree-row">
                                        <button
                                          className="tree-toggle-button"
                                          onClick={() => onToggleNode(monthNode.id)}
                                          aria-label="toggle"
                                        >
                                          {monthExpanded ? "▾" : "▸"}
                                        </button>
                                        <button
                                          className="tree-label-button tree-month-label"
                                          onClick={() => onToggleNode(monthNode.id)}
                                        >
                                          {monthNode.label}
                                        </button>
                                      </div>
                                      {monthExpanded ? (
                                        <div className="tree-children">
                                          {monthNode.entries.map((entryNode) => renderEntryNode(entryNode))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {typeNode.unknownEntries.length > 0 ? (
                        <div className="tree-node tree-unknown-node">
                          <div className="tree-row">
                            <button
                              className="tree-toggle-button"
                              onClick={() => onToggleNode(`${typeNode.id}:unknown`)}
                              aria-label="toggle"
                            >
                              {expandedSet.has(`${typeNode.id}:unknown`) ? "▾" : "▸"}
                            </button>
                            <button
                              className="tree-label-button tree-unknown-label"
                              onClick={() => onToggleNode(`${typeNode.id}:unknown`)}
                            >
                              {t("nav.timeUnknown")}
                            </button>
                          </div>
                          {expandedSet.has(`${typeNode.id}:unknown`) ? (
                            <div className="tree-children">
                              {typeNode.unknownEntries.map((entryNode) => renderEntryNode(entryNode))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hint-text">{t("nav.empty")}</div>
        )}
      </div>
      {renderContextMenu()}
    </aside>
  );
}
