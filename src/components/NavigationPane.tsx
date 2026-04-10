import type { EntryWithPages, PageRecord, SearchMode, SearchResult } from "../types";
import { formatPageLabel } from "../lib/utils";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

interface NavigationPaneProps {
  entries: EntryWithPages[];
  selectedEntryId: string | null;
  selectedPageId: string | null;
  expandedEntryIds: string[];
  searchQuery: string;
  searchMode: SearchMode;
  searchResults: SearchResult[];
  onSearchQueryChange: (value: string) => void;
  onSearchModeChange: (value: SearchMode) => void;
  onSelectEntry: (entryId: string) => void;
  onSelectPage: (page: PageRecord) => void;
  onToggleEntry: (entryId: string) => void;
  onOpenCreateDialog: () => void;
  onDeleteEntry: () => Promise<void>;
  onRefresh: () => Promise<void>;
  searching: boolean;
}

export function NavigationPane(props: NavigationPaneProps) {
  const { t } = useI18n();
  const {
    entries,
    selectedEntryId,
    selectedPageId,
    expandedEntryIds,
    searchQuery,
    searchMode,
    searchResults,
    onSearchQueryChange,
    onSearchModeChange,
    onSelectEntry,
    onSelectPage,
    onToggleEntry,
    onOpenCreateDialog,
    onDeleteEntry,
    onRefresh,
    searching,
  } = props;

  const showingResults = searchQuery.trim().length > 0;

  function matchedFieldKey(field: string): TranslationKey {
    const fieldMap: Record<string, TranslationKey> = {
      title: "result.matchedField.title",
      description: "result.matchedField.description",
      entry_type: "result.matchedField.entry_type",
      tags_json: "result.matchedField.tags_json",
      language_or_system: "result.matchedField.language_or_system",
      summary: "result.matchedField.summary",
      keywords_json: "result.matchedField.keywords_json",
      page_notes: "result.matchedField.page_notes",
      transcription_text: "result.matchedField.transcription_text",
      special_glyph_note: "result.matchedField.special_glyph_note",
    };

    return fieldMap[field] ?? "result.matchedField.description";
  }

  return (
    <aside className="pane pane-nav">
      <div className="pane-toolbar pane-toolbar-stacked">
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
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={onOpenCreateDialog}>
            {t("nav.newEntry")}
          </button>
          <button className="secondary-button" onClick={() => void onRefresh()}>
            {t("common.refresh")}
          </button>
          <button className="danger-button" onClick={() => void onDeleteEntry()} disabled={!selectedEntryId}>
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
                <strong>
                  {result.result_type === "page"
                    ? `${result.entry_title} - ${formatPageLabel(
                        result.page_number,
                        null,
                        t("common.page"),
                        t("common.untitledPage"),
                      )}`
                    : result.entry_title}
                </strong>
                <span className="search-result-meta">
                  {result.result_type === "page" ? t("nav.pageResult") : t("nav.entryResult")} -{" "}
                  {t(matchedFieldKey(result.matched_field))}
                </span>
                <p>{result.snippet}</p>
              </button>
            ))}
          </section>
        ) : (
          <section>
            <div className="section-heading">
              <h3>{t("common.entries")}</h3>
              <span>{entries.length}</span>
            </div>
            <div className="tree-list">
              {entries.map(({ entry, pages }) => {
                const expanded = expandedEntryIds.includes(entry.id);

                return (
                  <div key={entry.id} className="tree-entry">
                    <button
                      className={`tree-entry-button ${selectedEntryId === entry.id ? "is-active" : ""}`}
                      onClick={() => onSelectEntry(entry.id)}
                    >
                      <span>{expanded ? "v" : ">"}</span>
                      <div className="tree-entry-body">
                        <strong>{entry.title}</strong>
                        <span>
                          {entry.id} - {entry.page_count} {t("common.pages")}
                        </span>
                      </div>
                      <span
                        className="tree-toggle"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleEntry(entry.id);
                        }}
                      >
                        {expanded ? t("nav.hide") : t("nav.show")}
                      </span>
                    </button>
                    {expanded ? (
                      <div className="tree-pages">
                        {pages.map((page) => (
                          <button
                            key={page.id}
                            className={`tree-page-button ${selectedPageId === page.id ? "is-active" : ""}`}
                            onClick={() => onSelectPage(page)}
                          >
                            {formatPageLabel(
                              page.page_number,
                              page.page_label,
                              t("common.page"),
                              t("common.untitledPage"),
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
