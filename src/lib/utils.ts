export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
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
