import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CreateEntryInput } from "../types";
import {
  buildYearOptions,
  getValidDayOptions,
  splitCommaValues,
  UNCERTAIN_DATE_VALUE,
  YEAR_RANGE_END,
  YEAR_RANGE_START,
} from "../lib/utils";
import { useI18n } from "../i18n/I18nProvider";

interface CreateEntryDialogProps {
  openState: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEntryInput) => Promise<void>;
}

interface FormState {
  title: string;
  entry_type: string;
  date_year: string;
  date_month: string;
  date_day: string;
  date_note: string;
  description: string;
  notes: string;
}

const emptyForm: FormState = {
  title: "",
  entry_type: "",
  date_year: UNCERTAIN_DATE_VALUE,
  date_month: UNCERTAIN_DATE_VALUE,
  date_day: UNCERTAIN_DATE_VALUE,
  date_note: "",
  description: "",
  notes: "",
};

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === UNCERTAIN_DATE_VALUE) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CreateEntryDialog(props: CreateEntryDialogProps) {
  const { openState, creating, onClose, onSubmit } = props;
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tagsText, setTagsText] = useState("");
  const yearOptions = useMemo(() => buildYearOptions(), []);
  const selectedYear = useMemo(() => {
    const parsed = Number(form.date_year);
    return Number.isFinite(parsed) && parsed >= YEAR_RANGE_START && parsed <= YEAR_RANGE_END ? parsed : null;
  }, [form.date_year]);
  const selectedMonth = useMemo(() => {
    const parsed = Number(form.date_month);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
  }, [form.date_month]);
  const dayOptions = useMemo(() => getValidDayOptions(selectedYear, selectedMonth), [selectedMonth, selectedYear]);

  const canSubmit = useMemo(() => form.title.trim().length > 0, [form.title]);

  useEffect(() => {
    if (selectedMonth == null) {
      if (form.date_day !== UNCERTAIN_DATE_VALUE) {
        setForm((current) => ({ ...current, date_day: UNCERTAIN_DATE_VALUE }));
      }
      return;
    }

    if (form.date_day !== UNCERTAIN_DATE_VALUE && !dayOptions.includes(form.date_day)) {
      setForm((current) => ({ ...current, date_day: UNCERTAIN_DATE_VALUE }));
    }
  }, [dayOptions, form.date_day, selectedMonth]);

  if (!openState) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload: CreateEntryInput = {
      title: form.title,
      entry_type: form.entry_type,
      date_year: toOptionalNumber(form.date_year),
      date_month: toOptionalNumber(form.date_month),
      date_day: toOptionalNumber(form.date_day),
      date_year_uncertain: form.date_year === UNCERTAIN_DATE_VALUE ? 1 : 0,
      date_month_uncertain: form.date_month === UNCERTAIN_DATE_VALUE ? 1 : 0,
      date_day_uncertain: form.date_day === UNCERTAIN_DATE_VALUE ? 1 : 0,
      date_note: form.date_note,
      description: form.description,
      tags: splitCommaValues(tagsText),
      notes: form.notes,
    };

    await onSubmit(payload);
    setForm(emptyForm);
    setTagsText("");
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("dialog.newEntry")}</p>
            <h2>{t("button.createEntry")}</h2>
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
              onChange={(event) => setForm((current) => ({ ...current, entry_type: event.target.value }))}
              placeholder={t("placeholder.entryType")}
            />
          </label>

          <div className="form-grid-span-2">
            <div className="section-heading">
              <h3>{t("field.date")}</h3>
            </div>
            <div className="structured-date-grid">
              <label>
                <span>{t("field.dateYear")}</span>
                <input
                  list="create-entry-year-options"
                  value={form.date_year === UNCERTAIN_DATE_VALUE ? "" : form.date_year}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setForm((current) => ({
                      ...current,
                      date_year: value === "" ? UNCERTAIN_DATE_VALUE : value,
                    }));
                  }}
                  placeholder={t("common.unknown")}
                />
                <datalist id="create-entry-year-options">
                  {yearOptions.map((year) => (
                    <option key={year} value={year} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>{t("field.dateMonth")}</span>
                <select
                  value={form.date_month}
                  onChange={(event) => setForm((current) => ({ ...current, date_month: event.target.value }))}
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
                  value={form.date_day}
                  onChange={(event) => setForm((current) => ({ ...current, date_day: event.target.value }))}
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

          <label className="form-grid-span-2">
            <span>{t("field.dateNote")}</span>
            <input
              value={form.date_note}
              onChange={(event) => setForm((current) => ({ ...current, date_note: event.target.value }))}
              placeholder={t("placeholder.optional")}
            />
          </label>

          <label>
            <span>{t("field.tags")}</span>
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder={t("placeholder.tags")}
            />
          </label>

          <label className="form-grid-span-2">
            <span>{t("field.description")}</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
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
