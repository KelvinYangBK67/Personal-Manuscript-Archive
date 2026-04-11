import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AssetRecord, EditorTab, EntryRecord, PageRecord } from "../types";
import {
  buildYearOptions,
  formatPageLabel,
  getValidDayOptions,
  joinCommaValues,
  parseJsonArray,
  splitCommaValues,
  stringifyJsonArray,
  UNCERTAIN_DATE_VALUE,
  YEAR_RANGE_END,
  YEAR_RANGE_START,
} from "../lib/utils";
import { useDebouncedEffect } from "../hooks/useDebouncedEffect";
import { useI18n } from "../i18n/I18nProvider";

interface EditorPaneProps {
  entry: EntryRecord | null;
  page: PageRecord | null;
  assets: AssetRecord[];
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onSaveEntry: (entry: EntryRecord) => Promise<void>;
  onSavePage: (page: PageRecord) => Promise<void>;
  onImportResource: (sourcePath: string) => Promise<void>;
  onImportPdfPages: (input: { sourcePath: string; pageStart: number | null; pageEnd: number | null }) => Promise<void>;
  onDeleteResource: (asset: AssetRecord) => Promise<void>;
  importingResource: boolean;
}

interface EntryDraftState {
  data: EntryRecord;
  dateYearText: string;
  dateMonthText: string;
  dateDayText: string;
  tagsText: string;
}

interface PageDraftState {
  data: PageRecord;
  keywordsText: string;
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === UNCERTAIN_DATE_VALUE) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EditorPane(props: EditorPaneProps) {
  const { t } = useI18n();
  const {
    entry,
    page,
    assets,
    activeTab,
    onTabChange,
    onSaveEntry,
    onSavePage,
    onImportResource,
    onImportPdfPages,
    onDeleteResource,
    importingResource,
  } = props;

  const [entryDraft, setEntryDraft] = useState<EntryDraftState | null>(null);
  const [pageDraft, setPageDraft] = useState<PageDraftState | null>(null);

  useEffect(() => {
    if (!entry) {
      setEntryDraft(null);
      return;
    }
    setEntryDraft({
      data: entry,
      dateYearText: entry.date_year_uncertain === 1 || entry.date_year == null ? UNCERTAIN_DATE_VALUE : entry.date_year.toString(),
      dateMonthText:
        entry.date_month_uncertain === 1 || entry.date_month == null ? UNCERTAIN_DATE_VALUE : entry.date_month.toString(),
      dateDayText: entry.date_day_uncertain === 1 || entry.date_day == null ? UNCERTAIN_DATE_VALUE : entry.date_day.toString(),
      tagsText: joinCommaValues(parseJsonArray(entry.tags_json)),
    });
  }, [entry]);

  useEffect(() => {
    if (!page) {
      setPageDraft(null);
      return;
    }
    setPageDraft({
      data: page,
      keywordsText: joinCommaValues(parseJsonArray(page.keywords_json)),
    });
  }, [page]);

  const entryPayload = useMemo<EntryRecord | null>(() => {
    if (!entryDraft) {
      return null;
    }
    return {
      ...entryDraft.data,
      date_year: toOptionalNumber(entryDraft.dateYearText),
      date_month: toOptionalNumber(entryDraft.dateMonthText),
      date_day: toOptionalNumber(entryDraft.dateDayText),
      date_year_uncertain: entryDraft.dateYearText === UNCERTAIN_DATE_VALUE ? 1 : 0,
      date_month_uncertain: entryDraft.dateMonthText === UNCERTAIN_DATE_VALUE ? 1 : 0,
      date_day_uncertain: entryDraft.dateDayText === UNCERTAIN_DATE_VALUE ? 1 : 0,
      tags_json: stringifyJsonArray(splitCommaValues(entryDraft.tagsText)),
    };
  }, [entryDraft]);

  const pagePayload = useMemo<PageRecord | null>(() => {
    if (!pageDraft) {
      return null;
    }
    return {
      ...pageDraft.data,
      keywords_json: stringifyJsonArray(splitCommaValues(pageDraft.keywordsText)),
    };
  }, [pageDraft]);

  const entryDirty = useMemo(() => {
    if (!entryPayload || !entry) {
      return false;
    }
    return JSON.stringify(entryPayload) !== JSON.stringify({ ...entry, tags_json: stringifyJsonArray(parseJsonArray(entry.tags_json)) });
  }, [entry, entryPayload]);

  const pageDirty = useMemo(() => {
    if (!pagePayload || !page) {
      return false;
    }
    return JSON.stringify(pagePayload) !== JSON.stringify({ ...page, keywords_json: stringifyJsonArray(parseJsonArray(page.keywords_json)) });
  }, [page, pagePayload]);

  useDebouncedEffect(
    () => {
      if (entryPayload && entryDirty) {
        void onSaveEntry(entryPayload);
      }
    },
    450,
    [entryDirty, entryPayload],
  );

  useDebouncedEffect(
    () => {
      if (pagePayload && pageDirty) {
        void onSavePage(pagePayload);
      }
    },
    600,
    [pageDirty, pagePayload],
  );

  const title = useMemo(() => {
    if (pageDraft) {
      return formatPageLabel(
        pageDraft.data.page_number,
        pageDraft.data.page_label,
        t("common.page"),
        t("common.untitledPage"),
      );
    }
    if (entryDraft) {
      return entryDraft.data.title;
    }
    return t("editor.nothingSelected");
  }, [entryDraft, pageDraft, t]);

  const yearOptions = useMemo(() => buildYearOptions(), []);
  const selectedYear = useMemo(() => {
    if (!entryDraft) {
      return null;
    }
    const parsed = Number(entryDraft.dateYearText);
    return Number.isFinite(parsed) && parsed >= YEAR_RANGE_START && parsed <= YEAR_RANGE_END ? parsed : null;
  }, [entryDraft]);
  const selectedMonth = useMemo(() => {
    if (!entryDraft) {
      return null;
    }
    const parsed = Number(entryDraft.dateMonthText);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
  }, [entryDraft]);
  const dayOptions = useMemo(() => getValidDayOptions(selectedYear, selectedMonth), [selectedMonth, selectedYear]);

  function parseOptionalPageNumber(value: string | null): number | null | "invalid" {
    if (value == null) {
      return "invalid";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : "invalid";
  }

  useEffect(() => {
    if (!entryDraft) {
      return;
    }
    if (selectedMonth == null) {
      if (entryDraft.dateDayText !== UNCERTAIN_DATE_VALUE) {
        setEntryDraft((current) => (current ? { ...current, dateDayText: UNCERTAIN_DATE_VALUE } : current));
      }
      return;
    }
    if (entryDraft.dateDayText !== UNCERTAIN_DATE_VALUE && !dayOptions.includes(entryDraft.dateDayText)) {
      setEntryDraft((current) => (current ? { ...current, dateDayText: UNCERTAIN_DATE_VALUE } : current));
    }
  }, [dayOptions, entryDraft, selectedMonth]);

  async function chooseAndImportResource() {
    const selected = await open({ directory: false, multiple: false, title: t("button.importResource") });
    if (typeof selected === "string") {
      await onImportResource(selected);
    }
  }

  async function chooseAndImportPdfPages() {
    const selected = await open({
      directory: false,
      multiple: false,
      title: t("button.importPdfPages"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (typeof selected === "string") {
      const startValue = window.prompt(t("prompt.pdfImportStart"), "");
      if (startValue === null) {
        return;
      }
      const endValue = window.prompt(t("prompt.pdfImportEnd"), "");
      if (endValue === null) {
        return;
      }
      const pageStart = parseOptionalPageNumber(startValue);
      const pageEnd = parseOptionalPageNumber(endValue);
      if (pageStart === "invalid" || pageEnd === "invalid") {
        window.alert(t("notice.invalidPdfPageRange"));
        return;
      }
      await onImportPdfPages({
        sourcePath: selected,
        pageStart,
        pageEnd,
      });
    }
  }

  if (!entryDraft) {
    return (
      <aside className="pane pane-editor">
        <div className="pane-toolbar">
          <strong>{t("editor.editor")}</strong>
        </div>
        <div className="editor-empty">
          <p>{t("editor.selectEntryOrPage")}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="pane pane-editor">
      <div className="pane-toolbar pane-toolbar-stacked">
        <div>
          <p className="eyebrow">{t("editor.inspector")}</p>
          <h2>{title}</h2>
        </div>
        <div className="tabs">
          <button className={`tab-button ${activeTab === "metadata" ? "is-active" : ""}`} onClick={() => onTabChange("metadata")}>
            {t("editor.metadata")}
          </button>
          <button
            className={`tab-button ${activeTab === "transcription" ? "is-active" : ""}`}
            onClick={() => onTabChange("transcription")}
            disabled={!pageDraft}
          >
            {t("editor.transcription")}
          </button>
          <button className={`tab-button ${activeTab === "resources" ? "is-active" : ""}`} onClick={() => onTabChange("resources")}>
            {t("editor.resources")}
          </button>
        </div>
      </div>

      {activeTab === "metadata" ? (
        <div className="editor-scroll">
          <section className="editor-section">
            <div className="section-heading">
              <h3>{t("editor.entryMetadata")}</h3>
              <span>{entryDraft.data.id}</span>
            </div>
            <label>
              <span>{t("field.title")}</span>
              <input
                value={entryDraft.data.title}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, data: { ...current.data, title: event.target.value } } : current,
                  )
                }
              />
            </label>
            <label>
              <span>{t("field.entryType")}</span>
              <input
                value={entryDraft.data.entry_type ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, data: { ...current.data, entry_type: event.target.value } } : current,
                  )
                }
              />
            </label>

            <div>
              <div className="section-heading">
                <h3>{t("field.date")}</h3>
              </div>
              <div className="structured-date-grid">
                <label>
                  <span>{t("field.dateYear")}</span>
                  <input
                    list="editor-entry-year-options"
                    value={entryDraft.dateYearText === UNCERTAIN_DATE_VALUE ? "" : entryDraft.dateYearText}
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      setEntryDraft((current) =>
                        current ? { ...current, dateYearText: value === "" ? UNCERTAIN_DATE_VALUE : value } : current,
                      );
                    }}
                    placeholder={t("common.unknown")}
                  />
                  <datalist id="editor-entry-year-options">
                    {yearOptions.map((year) => (
                      <option key={year} value={year} />
                    ))}
                  </datalist>
                </label>
                <label>
                  <span>{t("field.dateMonth")}</span>
                  <select
                    value={entryDraft.dateMonthText}
                    onChange={(event) =>
                      setEntryDraft((current) => (current ? { ...current, dateMonthText: event.target.value } : current))
                    }
                  >
                    <option value={UNCERTAIN_DATE_VALUE}>{t("common.unknown")}</option>
                    {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("field.dateDay")}</span>
                  <select
                    value={entryDraft.dateDayText}
                    onChange={(event) =>
                      setEntryDraft((current) => (current ? { ...current, dateDayText: event.target.value } : current))
                    }
                    disabled={selectedMonth == null}
                  >
                    <option value={UNCERTAIN_DATE_VALUE}>{t("common.unknown")}</option>
                    {dayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <label>
              <span>{t("field.dateNote")}</span>
              <input
                value={entryDraft.data.date_note ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, data: { ...current.data, date_note: event.target.value } } : current,
                  )
                }
              />
            </label>
            <label>
              <span>{t("field.tags")}</span>
              <input value={entryDraft.tagsText} onChange={(event) => setEntryDraft((current) => (current ? { ...current, tagsText: event.target.value } : current))} />
            </label>
            <label>
              <span>{t("field.description")}</span>
              <textarea
                rows={4}
                value={entryDraft.data.description ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, data: { ...current.data, description: event.target.value } } : current,
                  )
                }
              />
            </label>
            <label>
              <span>{t("field.notes")}</span>
              <textarea
                rows={5}
                value={entryDraft.data.notes ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, data: { ...current.data, notes: event.target.value } } : current,
                  )
                }
              />
            </label>
          </section>

          {pageDraft ? (
            <section className="editor-section">
              <div className="section-heading">
                <h3>{t("editor.pageMetadata")}</h3>
                <span>{pageDraft.data.id}</span>
              </div>
              <div className="form-grid">
                <label>
                  <span>{t("field.pageOrder")}</span>
                  <input
                    type="number"
                    value={pageDraft.data.sort_order}
                    onChange={(event) =>
                      setPageDraft((current) =>
                        current
                          ? { ...current, data: { ...current.data, sort_order: Number(event.target.value || "0") } }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  <span>{t("field.pageNumber")}</span>
                  <input
                    type="number"
                    value={pageDraft.data.page_number ?? ""}
                    onChange={(event) =>
                      setPageDraft((current) =>
                        current
                          ? {
                              ...current,
                              data: { ...current.data, page_number: event.target.value ? Number(event.target.value) : null },
                            }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
              <label>
                <span>{t("field.pageLabel")}</span>
                <input
                  value={pageDraft.data.page_label ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, data: { ...current.data, page_label: event.target.value } } : current,
                    )
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>{t("field.sourcePdf")}</span>
                  <input value={pageDraft.data.source_pdf_path ?? ""} readOnly />
                </label>
                <label>
                  <span>{t("field.sourcePdfPage")}</span>
                  <input value={String(pageDraft.data.source_pdf_page_index + 1)} readOnly />
                </label>
              </div>
              <label>
                <span>{t("field.originalPageNumber")}</span>
                <input
                  type="number"
                  value={pageDraft.data.original_page_number ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current
                        ? {
                            ...current,
                            data: {
                              ...current.data,
                              original_page_number: event.target.value ? Number(event.target.value) : null,
                            },
                          }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>{t("field.summary")}</span>
                <textarea
                  rows={3}
                  value={pageDraft.data.summary ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, data: { ...current.data, summary: event.target.value } } : current,
                    )
                  }
                />
              </label>
              <label>
                <span>{t("field.keywords")}</span>
                <input value={pageDraft.keywordsText} onChange={(event) => setPageDraft((current) => (current ? { ...current, keywordsText: event.target.value } : current))} />
              </label>
              <label>
                <span>{t("field.pageNotes")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.data.page_notes ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, data: { ...current.data, page_notes: event.target.value } } : current,
                    )
                  }
                />
              </label>
            </section>
          ) : null}
        </div>
      ) : activeTab === "transcription" ? (
        <div className="editor-scroll">
          {pageDraft ? (
            <section className="editor-section">
              <div className="section-heading">
                <h3>{t("editor.pageTranscription")}</h3>
                <span>{pageDraft.data.id}</span>
              </div>
              <label>
                <span>{t("field.transcriptionText")}</span>
                <textarea
                  className="transcription-textarea"
                  rows={18}
                  value={pageDraft.data.transcription_text ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current
                        ? { ...current, data: { ...current.data, transcription_text: event.target.value } }
                        : current,
                    )
                  }
                />
              </label>
              <p className="hint-text">{t("hint.searchableTextOnly")}</p>
              <label>
                <span>{t("field.summary")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.data.summary ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, data: { ...current.data, summary: event.target.value } } : current,
                    )
                  }
                />
              </label>
              <label>
                <span>{t("field.pageNotes")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.data.page_notes ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, data: { ...current.data, page_notes: event.target.value } } : current,
                    )
                  }
                />
              </label>
            </section>
          ) : (
            <div className="editor-empty">
              <p>{t("editor.selectPageForTranscription")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="editor-scroll">
          <section className="editor-section">
            <div className="section-heading">
              <h3>{t("editor.resources")}</h3>
              <div className="action-row">
                <button className="secondary-button compact-button" onClick={() => void chooseAndImportPdfPages()} disabled={importingResource}>
                  {t("button.importPdfPages")}
                </button>
                <button className="primary-button compact-button" onClick={() => void chooseAndImportResource()} disabled={importingResource}>
                  {importingResource ? t("button.importing") : t("button.importResource")}
                </button>
              </div>
            </div>
            <p className="hint-text">{t("hint.resourcesRole")}</p>
            {assets.length === 0 ? (
              <p className="hint-text">{t("resources.empty")}</p>
            ) : (
              <div className="resource-list">
                {assets.map((asset) => (
                  <div key={asset.id} className="resource-card">
                    <div>
                      <strong>{asset.label ?? asset.file_path}</strong>
                      <div className="path-readout">{asset.asset_type}</div>
                      <div className="path-readout">{asset.file_path}</div>
                    </div>
                    <button className="ghost-button compact-button" onClick={() => void onDeleteResource(asset)}>
                      {t("button.deleteResource")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
