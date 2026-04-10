import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AssetRecord, EditorTab, EntryRecord, PageRecord } from "../types";
import { formatPageLabel, joinCommaValues, parseJsonArray, splitCommaValues, stringifyJsonArray } from "../lib/utils";
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
  onDeleteResource: (asset: AssetRecord) => Promise<void>;
  importingResource: boolean;
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
    onDeleteResource,
    importingResource,
  } = props;
  const [entryDraft, setEntryDraft] = useState<EntryRecord | null>(entry);
  const [pageDraft, setPageDraft] = useState<PageRecord | null>(page);
  const [entryTagsText, setEntryTagsText] = useState("");
  const [pageKeywordsText, setPageKeywordsText] = useState("");

  useEffect(() => {
    setEntryDraft(entry);
    setEntryTagsText(joinCommaValues(parseJsonArray(entry?.tags_json)));
  }, [entry]);

  useEffect(() => {
    setPageDraft(page);
    setPageKeywordsText(joinCommaValues(parseJsonArray(page?.keywords_json)));
  }, [page]);

  const entryPayload = useMemo<EntryRecord | null>(() => {
    if (!entryDraft) {
      return null;
    }
    return {
      ...entryDraft,
      tags_json: stringifyJsonArray(splitCommaValues(entryTagsText)),
    };
  }, [entryDraft, entryTagsText]);

  const entrySourceNormalized = useMemo<EntryRecord | null>(() => {
    if (!entry) {
      return null;
    }
    return {
      ...entry,
      tags_json: stringifyJsonArray(parseJsonArray(entry.tags_json)),
    };
  }, [entry]);

  const pagePayload = useMemo<PageRecord | null>(() => {
    if (!pageDraft) {
      return null;
    }
    return {
      ...pageDraft,
      keywords_json: stringifyJsonArray(splitCommaValues(pageKeywordsText)),
    };
  }, [pageDraft, pageKeywordsText]);

  const pageSourceNormalized = useMemo<PageRecord | null>(() => {
    if (!page) {
      return null;
    }
    return {
      ...page,
      keywords_json: stringifyJsonArray(parseJsonArray(page.keywords_json)),
    };
  }, [page]);

  const entryDirty = useMemo(() => {
    if (!entryPayload || !entrySourceNormalized) {
      return false;
    }
    return JSON.stringify(entryPayload) !== JSON.stringify(entrySourceNormalized);
  }, [entryPayload, entrySourceNormalized]);

  const pageDirty = useMemo(() => {
    if (!pagePayload || !pageSourceNormalized) {
      return false;
    }
    return JSON.stringify(pagePayload) !== JSON.stringify(pageSourceNormalized);
  }, [pagePayload, pageSourceNormalized]);

  useDebouncedEffect(
    () => {
      if (!entryPayload || !entryDirty) {
        return;
      }
      void onSaveEntry(entryPayload);
    },
    500,
    [entryDirty, entryPayload],
  );

  useDebouncedEffect(
    () => {
      if (!pagePayload || !pageDirty) {
        return;
      }
      void onSavePage(pagePayload);
    },
    650,
    [pageDirty, pagePayload],
  );

  const title = useMemo(() => {
    if (pageDraft) {
      return formatPageLabel(
        pageDraft.page_number,
        pageDraft.page_label,
        t("common.page"),
        t("common.untitledPage"),
      );
    }
    if (entryDraft) {
      return entryDraft.title;
    }
    return t("editor.nothingSelected");
  }, [entryDraft, pageDraft, t]);

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
          <button
            className={`tab-button ${activeTab === "metadata" ? "is-active" : ""}`}
            onClick={() => onTabChange("metadata")}
          >
            {t("editor.metadata")}
          </button>
          <button
            className={`tab-button ${activeTab === "transcription" ? "is-active" : ""}`}
            onClick={() => onTabChange("transcription")}
            disabled={!pageDraft}
          >
            {t("editor.transcription")}
          </button>
          <button
            className={`tab-button ${activeTab === "resources" ? "is-active" : ""}`}
            onClick={() => onTabChange("resources")}
          >
            {t("editor.resources")}
          </button>
        </div>
      </div>

      {activeTab === "metadata" ? (
        <div className="editor-scroll">
          <section className="editor-section">
            <div className="section-heading">
              <h3>{t("editor.entryMetadata")}</h3>
              <span>{entryDraft.id}</span>
            </div>
            <label>
              <span>{t("field.title")}</span>
              <input
                value={entryDraft.title}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, title: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.entryType")}</span>
              <input
                value={entryDraft.entry_type ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, entry_type: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.dateFrom")}</span>
              <input
                value={entryDraft.date_from ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, date_from: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.dateTo")}</span>
              <input
                value={entryDraft.date_to ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, date_to: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.datePrecision")}</span>
              <select
                value={entryDraft.date_precision ?? "unknown"}
                onChange={(event) =>
                  setEntryDraft((current) =>
                    current ? { ...current, date_precision: event.target.value } : current,
                  )
                }
              >
                <option value="day">{t("option.day")}</option>
                <option value="month">{t("option.month")}</option>
                <option value="year">{t("option.year")}</option>
                <option value="approximate">{t("option.approximate")}</option>
                <option value="unknown">{t("option.unknown")}</option>
              </select>
            </label>
            <label>
              <span>{t("field.tags")}</span>
              <input value={entryTagsText} onChange={(event) => setEntryTagsText(event.target.value)} />
            </label>
            <label>
              <span>{t("field.sourceForm")}</span>
              <input
                value={entryDraft.source_form ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, source_form: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.status")}</span>
              <input
                value={entryDraft.status ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, status: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.description")}</span>
              <textarea
                rows={4}
                value={entryDraft.description ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, description: event.target.value } : current))
                }
              />
            </label>
            <label>
              <span>{t("field.notes")}</span>
              <textarea
                rows={5}
                value={entryDraft.notes ?? ""}
                onChange={(event) =>
                  setEntryDraft((current) => (current ? { ...current, notes: event.target.value } : current))
                }
              />
            </label>
          </section>
          {pageDraft ? (
            <section className="editor-section">
              <div className="section-heading">
                <h3>{t("editor.pageMetadata")}</h3>
                <span>{pageDraft.id}</span>
              </div>
              <label>
                <span>{t("field.pageNumber")}</span>
                <input
                  type="number"
                  value={pageDraft.page_number ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current
                        ? { ...current, page_number: event.target.value ? Number(event.target.value) : null }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>{t("field.pageLabel")}</span>
                <input
                  value={pageDraft.page_label ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, page_label: event.target.value } : current))
                  }
                />
              </label>
              <label>
                <span>{t("field.summary")}</span>
                <textarea
                  rows={3}
                  value={pageDraft.summary ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, summary: event.target.value } : current))
                  }
                />
              </label>
              <label>
                <span>{t("field.keywords")}</span>
                <input value={pageKeywordsText} onChange={(event) => setPageKeywordsText(event.target.value)} />
              </label>
              <label>
                <span>{t("field.transcriptionStatus")}</span>
                <select
                  value={pageDraft.transcription_status ?? "none"}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, transcription_status: event.target.value } : current,
                    )
                  }
                >
                  <option value="none">{t("option.none")}</option>
                  <option value="partial">{t("option.partial")}</option>
                  <option value="complete">{t("option.complete")}</option>
                  <option value="summary_only">{t("option.summaryOnly")}</option>
                </select>
              </label>
              <label>
                <span>{t("field.legibility")}</span>
                <select
                  value={pageDraft.legibility ?? "clear"}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, legibility: event.target.value } : current))
                  }
                >
                  <option value="clear">{t("option.clear")}</option>
                  <option value="medium">{t("option.medium")}</option>
                  <option value="difficult">{t("option.difficult")}</option>
                  <option value="nearly_illegible">{t("option.nearlyIllegible")}</option>
                </select>
              </label>
              <label>
                <span>{t("field.pageNotes")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.page_notes ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, page_notes: event.target.value } : current))
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
                <span>{pageDraft.id}</span>
              </div>
              <label>
                <span>{t("field.transcriptionText")}</span>
                <textarea
                  className="transcription-textarea"
                  rows={18}
                  value={pageDraft.transcription_text ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) =>
                      current ? { ...current, transcription_text: event.target.value } : current,
                    )
                  }
                />
              </label>
              <p className="hint-text">{t("hint.searchableTextOnly")}</p>
              <label>
                <span>{t("field.summary")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.summary ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, summary: event.target.value } : current))
                  }
                />
              </label>
              <label>
                <span>{t("field.pageNotes")}</span>
                <textarea
                  rows={4}
                  value={pageDraft.page_notes ?? ""}
                  onChange={(event) =>
                    setPageDraft((current) => (current ? { ...current, page_notes: event.target.value } : current))
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
                <span>{assets.length}</span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={importingResource}
                  onClick={async () => {
                    const selected = await open({
                      directory: false,
                      multiple: false,
                      title: t("editor.resources"),
                    });

                    if (typeof selected === "string") {
                      await onImportResource(selected);
                    }
                  }}
                >
                  {importingResource ? t("button.importing") : t("button.importResource")}
                </button>
              </div>
            </div>
            <p className="hint-text">{t("hint.resourcesRole")}</p>
            {assets.length > 0 ? (
              <div className="resource-list">
                {assets.map((asset) => {
                  const fileName = asset.file_path.split(/[\\/]/).pop() || asset.file_path;
                  return (
                    <article key={asset.id} className="resource-card">
                      <div className="section-heading">
                        <div>
                          <strong>{asset.label?.trim() || fileName}</strong>
                          <div className="path-readout">{asset.file_path}</div>
                        </div>
                        <div className="action-row">
                          <span className="resource-type-chip">{asset.asset_type}</span>
                          <button
                            type="button"
                            className="danger-button resource-delete-button"
                            onClick={() => void onDeleteResource(asset)}
                          >
                            {t("button.deleteResource")}
                          </button>
                        </div>
                      </div>
                      {asset.notes ? (
                        <p className="resource-notes">{asset.notes}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="editor-empty">
                <p>{t("resources.empty")}</p>
              </div>
            )}
          </section>
        </div>
      )}
      <div className="autosave-note">{t("editor.autosave")}</div>
    </aside>
  );
}
