import { FormEvent, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { CreateEntryInput } from "../types";
import { splitCommaValues } from "../lib/utils";
import { useI18n } from "../i18n/I18nProvider";

interface CreateEntryDialogProps {
  openState: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEntryInput) => Promise<void>;
}

const emptyInput: CreateEntryInput = {
  title: "",
  entry_type: "",
  date_from: "",
  date_to: "",
  date_precision: "unknown",
  description: "",
  language_or_system: "",
  tags: [],
  source_form: "pdf",
  status: "unprocessed",
  notes: "",
  canonical_pdf_source: "",
};

export function CreateEntryDialog(props: CreateEntryDialogProps) {
  const { openState, creating, onClose, onSubmit } = props;
  const { t } = useI18n();
  const [form, setForm] = useState<CreateEntryInput>(emptyInput);
  const [tagsText, setTagsText] = useState("");

  const canSubmit = useMemo(() => {
    return form.title.trim().length > 0 && form.canonical_pdf_source.trim().length > 0;
  }, [form]);

  if (!openState) {
    return null;
  }

  async function handleChoosePdf() {
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      title: t("field.canonicalPdf"),
    });

    if (typeof selected === "string") {
      setForm((current) => ({ ...current, canonical_pdf_source: selected }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...form,
      tags: splitCommaValues(tagsText),
    });
    setForm(emptyInput);
    setTagsText("");
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("dialog.newEntry")}</p>
            <h2>{t("dialog.createImportPdf")}</h2>
          </div>
          <button className="ghost-button" onClick={onClose} disabled={creating}>
            {t("common.close")}
          </button>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>{t("field.title")}</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholder.entryTitle")}
            />
          </label>
          <label>
            <span>{t("field.entryType")}</span>
            <input
              value={form.entry_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, entry_type: event.target.value }))
              }
              placeholder={t("placeholder.entryType")}
            />
          </label>
          <label>
            <span>{t("field.dateFrom")}</span>
            <input
              value={form.date_from}
              onChange={(event) => setForm((current) => ({ ...current, date_from: event.target.value }))}
              placeholder={t("placeholder.dateFrom")}
            />
          </label>
          <label>
            <span>{t("field.dateTo")}</span>
            <input
              value={form.date_to}
              onChange={(event) => setForm((current) => ({ ...current, date_to: event.target.value }))}
              placeholder={t("placeholder.optional")}
            />
          </label>
          <label>
            <span>{t("field.datePrecision")}</span>
            <select
              value={form.date_precision}
              onChange={(event) =>
                setForm((current) => ({ ...current, date_precision: event.target.value }))
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
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder={t("placeholder.tags")}
            />
          </label>
          <label>
            <span>{t("field.sourceForm")}</span>
            <input
              value={form.source_form}
              onChange={(event) =>
                setForm((current) => ({ ...current, source_form: event.target.value }))
              }
            />
          </label>
          <label>
            <span>{t("field.status")}</span>
            <input
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            />
          </label>
          <label className="form-grid-span-2">
            <span>{t("field.description")}</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label className="form-grid-span-2">
            <span>{t("field.notes")}</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <label className="form-grid-span-2">
            <span>{t("field.canonicalPdf")}</span>
            <div className="file-picker">
              <input value={form.canonical_pdf_source} readOnly placeholder={t("placeholder.choosePdfFile")} />
              <button type="button" className="secondary-button" onClick={handleChoosePdf}>
                {t("button.choosePdf")}
              </button>
            </div>
          </label>
          <div className="modal-actions form-grid-span-2">
            <button type="button" className="ghost-button" onClick={onClose} disabled={creating}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="primary-button" disabled={!canSubmit || creating}>
              {creating ? t("button.importing") : t("button.createEntry")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
