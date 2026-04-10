import type { DatePartMode, EntryRecord, EntryWithPages, PageRecord } from "../types";

export const YEAR_RANGE_START = 1900;
export const YEAR_RANGE_END = 2200;
export const UNCERTAIN_DATE_VALUE = "uncertain";

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function stringifyJsonArray(values: string[]): string {
  return JSON.stringify(values.map((value) => value.trim()).filter(Boolean));
}

export function splitCommaValues(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinCommaValues(values: string[]): string {
  return values.join(", ");
}

export function formatPageLabel(
  pageNumber: number | null,
  pageLabel: string | null,
  pageWord = "Page",
  untitledPage = "Untitled page",
): string {
  if (pageLabel && pageNumber) {
    return `${pageWord} ${pageNumber} - ${pageLabel}`;
  }
  if (pageLabel) {
    return pageLabel;
  }
  if (pageNumber) {
    return `${pageWord} ${pageNumber}`;
  }
  return untitledPage;
}

export function parseDatePartMode(value: number | null | undefined, uncertain: number | null | undefined): DatePartMode {
  return value == null || Boolean(uncertain) ? "uncertain" : "known";
}

function normalizeEntryRecord(entry: EntryWithPages | EntryRecord): EntryRecord {
  return "entry" in entry ? entry.entry : entry;
}

export function buildDateSortKey(entry: EntryWithPages | EntryRecord): [string, number, number, number, number, number, number] {
  const record = normalizeEntryRecord(entry);
  return [
    (record.entry_type || "").toLocaleLowerCase(),
    record.date_year ?? Number.MAX_SAFE_INTEGER,
    record.date_year_uncertain ? 1 : 0,
    record.date_month ?? Number.MAX_SAFE_INTEGER,
    record.date_month_uncertain ? 1 : 0,
    record.date_day ?? Number.MAX_SAFE_INTEGER,
    record.date_day_uncertain ? 1 : 0,
  ];
}

export function compareEntriesByStructuredDate(left: EntryWithPages | EntryRecord, right: EntryWithPages | EntryRecord): number {
  const [leftType, leftYear, leftYearUncertain, leftMonth, leftMonthUncertain, leftDay, leftDayUncertain] = buildDateSortKey(left);
  const [rightType, rightYear, rightYearUncertain, rightMonth, rightMonthUncertain, rightDay, rightDayUncertain] = buildDateSortKey(right);
  const leftRecord = normalizeEntryRecord(left);
  const rightRecord = normalizeEntryRecord(right);

  return (
    leftType.localeCompare(rightType) ||
    leftYear - rightYear ||
    leftYearUncertain - rightYearUncertain ||
    leftMonth - rightMonth ||
    leftMonthUncertain - rightMonthUncertain ||
    leftDay - rightDay ||
    leftDayUncertain - rightDayUncertain ||
    leftRecord.title.localeCompare(rightRecord.title)
  );
}

export function comparePagesBySortOrder(left: PageRecord, right: PageRecord): number {
  return (
    left.sort_order - right.sort_order ||
    (left.source_pdf_path || "").localeCompare(right.source_pdf_path || "") ||
    left.source_pdf_page_index - right.source_pdf_page_index ||
    left.id.localeCompare(right.id)
  );
}

export function buildYearOptions(): string[] {
  const years: string[] = [];
  for (let year = YEAR_RANGE_START; year <= YEAR_RANGE_END; year += 1) {
    years.push(String(year));
  }
  return years;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getValidDayCount(year: number | null, month: number | null): number {
  if (month == null) {
    return 0;
  }
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
    return 31;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  if (month === 2) {
    if (year == null) {
      return 29;
    }
    return isLeapYear(year) ? 29 : 28;
  }
  return 0;
}

export function getValidDayOptions(year: number | null, month: number | null): string[] {
  const dayCount = getValidDayCount(year, month);
  return Array.from({ length: dayCount }, (_, index) => String(index + 1));
}
