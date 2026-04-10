export type Locale = "zh-TW" | "en" | "de";

export type TranslationKey =
  | "app.name"
  | "app.desktopArchive"
  | "app.language"
  | "archive.localArchive"
  | "archive.chooseRootTitle"
  | "archive.description"
  | "archive.opening"
  | "archive.changeRoot"
  | "archive.chooseRoot"
  | "dialog.newEntry"
  | "dialog.createImportPdf"
  | "common.close"
  | "common.cancel"
  | "common.refresh"
  | "common.searching"
  | "common.page"
  | "common.pages"
  | "common.entry"
  | "common.entries"
  | "common.untitledPage"
  | "nav.searchPlaceholder"
  | "nav.metadataSearch"
  | "nav.fullTextSearch"
  | "nav.newEntry"
  | "nav.deleteEntry"
  | "nav.results"
  | "nav.matches"
  | "nav.pageResult"
  | "nav.entryResult"
  | "nav.show"
  | "nav.hide"
  | "viewer.loadPdfPrompt"
  | "viewer.loadingPdf"
  | "viewer.unableToLoadPdf"
  | "viewer.previous"
  | "viewer.next"
  | "viewer.jump"
  | "viewer.zoomOut"
  | "viewer.zoomIn"
  | "viewer.fitWidth"
  | "viewer.fitPage"
  | "viewer.pageCounter"
  | "viewer.zoomHelp"
  | "editor.editor"
  | "editor.selectEntryOrPage"
  | "editor.inspector"
  | "editor.metadata"
  | "editor.transcription"
  | "editor.resources"
  | "editor.entryMetadata"
  | "editor.pageMetadata"
  | "editor.pageTranscription"
  | "editor.nothingSelected"
  | "editor.selectPageForTranscription"
  | "editor.autosave"
  | "field.title"
  | "field.entryType"
  | "field.dateFrom"
  | "field.dateTo"
  | "field.datePrecision"
  | "field.languageOrSystem"
  | "field.tags"
  | "field.sourceForm"
  | "field.status"
  | "field.description"
  | "field.notes"
  | "field.canonicalPdf"
  | "field.pageNumber"
  | "field.pageLabel"
  | "field.summary"
  | "field.keywords"
  | "field.transcriptionStatus"
  | "field.legibility"
  | "field.containsSpecialGlyphs"
  | "field.specialGlyphNote"
  | "field.pageNotes"
  | "field.transcriptionText"
  | "button.choosePdf"
  | "button.createEntry"
  | "button.importResource"
  | "button.deleteResource"
  | "button.importing"
  | "prompt.importExtract"
  | "prompt.transcriptionExists"
  | "option.saveResourceOnly"
  | "option.saveResourceAndExtract"
  | "option.replaceTranscription"
  | "option.appendTranscription"
  | "option.cancelInsertion"
  | "notice.extractionSuccess"
  | "notice.extractionFailed"
  | "notice.extractionUnsupported"
  | "hint.searchableTextOnly"
  | "hint.resourcesRole"
  | "resources.empty"
  | "placeholder.entryTitle"
  | "placeholder.entryType"
  | "placeholder.dateFrom"
  | "placeholder.optional"
  | "placeholder.languageOrSystem"
  | "placeholder.tags"
  | "placeholder.choosePdfFile"
  | "option.day"
  | "option.month"
  | "option.year"
  | "option.approximate"
  | "option.unknown"
  | "option.none"
  | "option.partial"
  | "option.complete"
  | "option.summaryOnly"
  | "option.clear"
  | "option.medium"
  | "option.difficult"
  | "option.nearlyIllegible"
  | "confirm.deleteEntry"
  | "result.matchedField.title"
  | "result.matchedField.description"
  | "result.matchedField.entry_type"
  | "result.matchedField.tags_json"
  | "result.matchedField.language_or_system"
  | "result.matchedField.summary"
  | "result.matchedField.keywords_json"
  | "result.matchedField.page_notes"
  | "result.matchedField.transcription_text"
  | "result.matchedField.special_glyph_note";

export type TranslationValue = string | ((vars: Record<string, string | number>) => string);

export const translations: Record<Locale, Record<TranslationKey, TranslationValue>> = {
  "zh-TW": {
    "app.name": "個人手稿檔案庫",
    "app.desktopArchive": "桌面檔案庫",
    "app.language": "語言",
    "archive.localArchive": "本機檔案庫",
    "archive.chooseRootTitle": "選擇檔案庫根目錄",
    "archive.description":
      "請選擇一個檔案庫根目錄。資料庫、受管資產、縮圖、匯出與垃圾桶都會以可見的結構存放在其中。",
    "archive.opening": "正在開啟檔案庫...",
    "archive.changeRoot": "更換檔案庫根目錄",
    "archive.chooseRoot": "選擇檔案庫根目錄",
    "dialog.newEntry": "新增條目",
    "dialog.createImportPdf": "建立條目並匯入主閱讀 PDF",
    "common.close": "關閉",
    "common.cancel": "取消",
    "common.refresh": "重新整理",
    "common.searching": "搜尋中...",
    "common.page": "頁",
    "common.pages": "頁",
    "common.entry": "條目",
    "common.entries": "條目",
    "common.untitledPage": "未命名頁面",
    "nav.searchPlaceholder": "搜尋資料或可檢索文本...",
    "nav.metadataSearch": "資料搜尋",
    "nav.fullTextSearch": "全文搜尋",
    "nav.newEntry": "新增條目",
    "nav.deleteEntry": "刪除條目",
    "nav.results": "結果",
    "nav.matches": ({ count }) => `${count} 筆符合`,
    "nav.pageResult": "頁面結果",
    "nav.entryResult": "條目結果",
    "nav.show": "展開",
    "nav.hide": "收合",
    "viewer.loadPdfPrompt": "請先選取含主閱讀 PDF 的條目。",
    "viewer.loadingPdf": "正在載入 PDF...",
    "viewer.unableToLoadPdf": ({ error }) => `無法載入 PDF：${error}`,
    "viewer.previous": "上一頁",
    "viewer.next": "下一頁",
    "viewer.jump": "跳頁",
    "viewer.zoomOut": "縮小",
    "viewer.zoomIn": "放大",
    "viewer.fitWidth": "符合欄寬",
    "viewer.fitPage": "符合整頁",
    "viewer.pageCounter": ({ current, total }) => `第 ${current} / ${total} 頁`,
    "viewer.zoomHelp": "Ctrl + 滾輪可縮放",
    "editor.editor": "編輯器",
    "editor.selectEntryOrPage": "請選取條目或頁面以編輯資料與可檢索文本。",
    "editor.inspector": "檢視器",
    "editor.metadata": "資訊",
    "editor.transcription": "轉寫",
    "editor.resources": "資源",
    "editor.entryMetadata": "條目資訊",
    "editor.pageMetadata": "頁面資訊",
    "editor.pageTranscription": "頁面可檢索文本",
    "editor.nothingSelected": "尚未選取",
    "editor.selectPageForTranscription": "請選取頁面以編輯該頁唯一的可檢索文本。",
    "editor.autosave": "編輯暫停片刻後會自動儲存。",
    "field.title": "標題",
    "field.entryType": "條目類型",
    "field.dateFrom": "起始日期",
    "field.dateTo": "結束日期",
    "field.datePrecision": "日期精度",
    "field.languageOrSystem": "語言或系統",
    "field.tags": "標籤",
    "field.sourceForm": "來源形式",
    "field.status": "狀態",
    "field.description": "描述",
    "field.notes": "備註",
    "field.canonicalPdf": "主閱讀 PDF",
    "field.pageNumber": "頁碼",
    "field.pageLabel": "頁面標籤",
    "field.summary": "摘要",
    "field.keywords": "關鍵詞",
    "field.transcriptionStatus": "轉寫狀態",
    "field.legibility": "可辨識度",
    "field.containsSpecialGlyphs": "含特殊字形",
    "field.specialGlyphNote": "特殊字形備註",
    "field.pageNotes": "頁面備註",
    "field.transcriptionText": "可檢索文本",
    "button.choosePdf": "選擇 PDF",
    "button.createEntry": "建立條目",
    "button.importResource": "匯入資源",
    "button.deleteResource": "刪除資源",
    "button.importing": "匯入中...",
    "prompt.importExtract": "匯入時是否自動抽取爲轉寫",
    "prompt.transcriptionExists": "轉寫已存在，請選擇如何處理",
    "option.saveResourceOnly": "僅作爲資源保存",
    "option.saveResourceAndExtract": "作爲資源保存，並自動抽取純文本到轉寫",
    "option.replaceTranscription": "覆蓋現有轉寫",
    "option.appendTranscription": "追加到現有轉寫後面",
    "option.cancelInsertion": "取消本次寫入",
    "notice.extractionSuccess": "已成功抽取純文本",
    "notice.extractionFailed": "無法從該文件抽取純文本",
    "notice.extractionUnsupported": "此文件類型暫不支持自動抽取",
    "hint.searchableTextOnly":
      "此區只維護這一頁唯一的可檢索文本，用於搜尋、索引與快速辨認內容，不負責重建原始格式。特殊字形可用 [G001] 或 [UNK-1] 之類的占位符表示。",
    "hint.resourcesRole": "附屬電子資源會列在這裡，用來輔助整理與比對，不取代中間的主閱讀 PDF。",
    "resources.empty": "此條目尚無附屬電子資源。",
    "placeholder.entryTitle": "條目標題",
    "placeholder.entryType": "日記、手稿、摘錄...",
    "placeholder.dateFrom": "YYYY-MM-DD 或自由文字",
    "placeholder.optional": "可選填",
    "placeholder.languageOrSystem": "中文、混合、構造語階段...",
    "placeholder.tags": "以逗號分隔標籤",
    "placeholder.choosePdfFile": "選擇 PDF 檔案",
    "option.day": "日",
    "option.month": "月",
    "option.year": "年",
    "option.approximate": "約略",
    "option.unknown": "未知",
    "option.none": "無",
    "option.partial": "部分",
    "option.complete": "完成",
    "option.summaryOnly": "僅摘要",
    "option.clear": "清晰",
    "option.medium": "中等",
    "option.difficult": "困難",
    "option.nearlyIllegible": "幾乎無法辨識",
    "confirm.deleteEntry": "要刪除此條目並將其受管 PDF 移到檔案庫垃圾桶嗎？",
    "result.matchedField.title": "標題",
    "result.matchedField.description": "描述",
    "result.matchedField.entry_type": "條目類型",
    "result.matchedField.tags_json": "標籤",
    "result.matchedField.language_or_system": "語言或系統",
    "result.matchedField.summary": "摘要",
    "result.matchedField.keywords_json": "關鍵詞",
    "result.matchedField.page_notes": "頁面備註",
    "result.matchedField.transcription_text": "可檢索文本",
    "result.matchedField.special_glyph_note": "特殊字形備註",
  },
  en: {
    "app.name": "Personal Manuscript Archive",
    "app.desktopArchive": "Desktop archive",
    "app.language": "Language",
    "archive.localArchive": "Local archive",
    "archive.chooseRootTitle": "Choose archive root",
    "archive.description":
      "Choose an archive root folder. The database, managed assets, thumbnails, exports, and trash folder will be stored there in a visible structure.",
    "archive.opening": "Opening archive...",
    "archive.changeRoot": "Change archive root",
    "archive.chooseRoot": "Choose archive root",
    "dialog.newEntry": "New entry",
    "dialog.createImportPdf": "Create and import a canonical PDF",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.refresh": "Refresh",
    "common.searching": "Searching...",
    "common.page": "Page",
    "common.pages": "pages",
    "common.entry": "Entry",
    "common.entries": "Entries",
    "common.untitledPage": "Untitled page",
    "nav.searchPlaceholder": "Search metadata or searchable text...",
    "nav.metadataSearch": "Metadata search",
    "nav.fullTextSearch": "Full text search",
    "nav.newEntry": "New entry",
    "nav.deleteEntry": "Delete entry",
    "nav.results": "Results",
    "nav.matches": ({ count }) => `${count} matches`,
    "nav.pageResult": "Page result",
    "nav.entryResult": "Entry result",
    "nav.show": "Show",
    "nav.hide": "Hide",
    "viewer.loadPdfPrompt": "Load an entry with a canonical PDF.",
    "viewer.loadingPdf": "Loading PDF...",
    "viewer.unableToLoadPdf": ({ error }) => `Unable to load PDF: ${error}`,
    "viewer.previous": "Previous",
    "viewer.next": "Next",
    "viewer.jump": "Jump",
    "viewer.zoomOut": "Zoom -",
    "viewer.zoomIn": "Zoom +",
    "viewer.fitWidth": "Fit width",
    "viewer.fitPage": "Fit page",
    "viewer.pageCounter": ({ current, total }) => `Page ${current} / ${total}`,
    "viewer.zoomHelp": "Ctrl + wheel to zoom",
    "editor.editor": "Editor",
    "editor.selectEntryOrPage": "Select an entry or page to edit metadata and searchable text.",
    "editor.inspector": "Inspector",
    "editor.metadata": "Info",
    "editor.transcription": "Transcription",
    "editor.resources": "Resources",
    "editor.entryMetadata": "Entry metadata",
    "editor.pageMetadata": "Page metadata",
    "editor.pageTranscription": "Page searchable text",
    "editor.nothingSelected": "Nothing selected",
    "editor.selectPageForTranscription": "Select a page to edit its single searchable text.",
    "editor.autosave": "Autosave runs after a short pause while you edit.",
    "field.title": "Title",
    "field.entryType": "Entry type",
    "field.dateFrom": "Date from",
    "field.dateTo": "Date to",
    "field.datePrecision": "Date precision",
    "field.languageOrSystem": "Language or system",
    "field.tags": "Tags",
    "field.sourceForm": "Source form",
    "field.status": "Status",
    "field.description": "Description",
    "field.notes": "Notes",
    "field.canonicalPdf": "Canonical PDF",
    "field.pageNumber": "Page number",
    "field.pageLabel": "Page label",
    "field.summary": "Summary",
    "field.keywords": "Keywords",
    "field.transcriptionStatus": "Transcription status",
    "field.legibility": "Legibility",
    "field.containsSpecialGlyphs": "Contains special glyphs",
    "field.specialGlyphNote": "Special glyph note",
    "field.pageNotes": "Page notes",
    "field.transcriptionText": "Searchable text",
    "button.choosePdf": "Choose PDF",
    "button.createEntry": "Create entry",
    "button.importResource": "Import resource",
    "button.deleteResource": "Delete resource",
    "button.importing": "Importing...",
    "prompt.importExtract": "Extract as transcription automatically during import?",
    "prompt.transcriptionExists": "A transcription already exists. Please choose how to proceed",
    "option.saveResourceOnly": "Save as resource only",
    "option.saveResourceAndExtract":
      "Save as resource and automatically extract plain text into transcription",
    "option.replaceTranscription": "Replace existing transcription",
    "option.appendTranscription": "Append to existing transcription",
    "option.cancelInsertion": "Cancel this insertion",
    "notice.extractionSuccess": "Plain text extracted successfully",
    "notice.extractionFailed": "Unable to extract plain text from this file",
    "notice.extractionUnsupported": "Automatic extraction is not supported for this file type yet",
    "hint.searchableTextOnly":
      "This field stores the single searchable text for the page. Use it for search, indexing, and quick recognition, not for reconstructing original formatting. Use placeholders like [G001] or [UNK-1] for unusual glyphs.",
    "hint.resourcesRole":
      "Attached digital resources are listed here as supporting materials. They do not replace the canonical PDF in the center reader.",
    "resources.empty": "No attached digital resources for this entry yet.",
    "placeholder.entryTitle": "Entry title",
    "placeholder.entryType": "diary, manuscript, excerpt...",
    "placeholder.dateFrom": "YYYY-MM-DD or free text",
    "placeholder.optional": "Optional",
    "placeholder.languageOrSystem": "Chinese, Mixed, Conlang stage...",
    "placeholder.tags": "comma, separated, tags",
    "placeholder.choosePdfFile": "Choose a PDF file",
    "option.day": "day",
    "option.month": "month",
    "option.year": "year",
    "option.approximate": "approximate",
    "option.unknown": "unknown",
    "option.none": "none",
    "option.partial": "partial",
    "option.complete": "complete",
    "option.summaryOnly": "summary only",
    "option.clear": "clear",
    "option.medium": "medium",
    "option.difficult": "difficult",
    "option.nearlyIllegible": "nearly illegible",
    "confirm.deleteEntry": "Delete this entry and move its managed PDF into the archive trash folder?",
    "result.matchedField.title": "title",
    "result.matchedField.description": "description",
    "result.matchedField.entry_type": "entry type",
    "result.matchedField.tags_json": "tags",
    "result.matchedField.language_or_system": "language or system",
    "result.matchedField.summary": "summary",
    "result.matchedField.keywords_json": "keywords",
    "result.matchedField.page_notes": "page notes",
    "result.matchedField.transcription_text": "searchable text",
    "result.matchedField.special_glyph_note": "special glyph note",
  },
  de: {
    "app.name": "Persönliches Manuskriptarchiv",
    "app.desktopArchive": "Desktop-Archiv",
    "app.language": "Sprache",
    "archive.localArchive": "Lokales Archiv",
    "archive.chooseRootTitle": "Archivstammordner auswählen",
    "archive.description":
      "Wähle einen Archivordner aus. Datenbank, verwaltete Dateien, Vorschaubilder, Exporte und Papierkorb werden dort in einer sichtbaren Struktur gespeichert.",
    "archive.opening": "Archiv wird geöffnet...",
    "archive.changeRoot": "Archivstammordner ändern",
    "archive.chooseRoot": "Archivstammordner auswählen",
    "dialog.newEntry": "Neuer Eintrag",
    "dialog.createImportPdf": "Eintrag erstellen und Haupt-PDF importieren",
    "common.close": "Schließen",
    "common.cancel": "Abbrechen",
    "common.refresh": "Aktualisieren",
    "common.searching": "Suche läuft...",
    "common.page": "Seite",
    "common.pages": "Seiten",
    "common.entry": "Eintrag",
    "common.entries": "Einträge",
    "common.untitledPage": "Unbenannte Seite",
    "nav.searchPlaceholder": "Metadaten oder durchsuchbaren Text suchen...",
    "nav.metadataSearch": "Metadaten durchsuchen",
    "nav.fullTextSearch": "Volltext durchsuchen",
    "nav.newEntry": "Neuer Eintrag",
    "nav.deleteEntry": "Eintrag löschen",
    "nav.results": "Ergebnisse",
    "nav.matches": ({ count }) => `${count} Treffer`,
    "nav.pageResult": "Seitentreffer",
    "nav.entryResult": "Eintragstreffer",
    "nav.show": "Anzeigen",
    "nav.hide": "Ausblenden",
    "viewer.loadPdfPrompt": "Lade einen Eintrag mit einem Haupt-PDF.",
    "viewer.loadingPdf": "PDF wird geladen...",
    "viewer.unableToLoadPdf": ({ error }) => `PDF konnte nicht geladen werden: ${error}`,
    "viewer.previous": "Zurück",
    "viewer.next": "Weiter",
    "viewer.jump": "Gehe zu",
    "viewer.zoomOut": "Verkleinern",
    "viewer.zoomIn": "Vergrößern",
    "viewer.fitWidth": "An Breite anpassen",
    "viewer.fitPage": "An Seite anpassen",
    "viewer.pageCounter": ({ current, total }) => `Seite ${current} / ${total}`,
    "viewer.zoomHelp": "Strg + Mausrad zum Zoomen",
    "editor.editor": "Editor",
    "editor.selectEntryOrPage": "Wähle einen Eintrag oder eine Seite aus, um Metadaten und durchsuchbaren Text zu bearbeiten.",
    "editor.inspector": "Inspektor",
    "editor.metadata": "Info",
    "editor.transcription": "Transkription",
    "editor.resources": "Ressourcen",
    "editor.entryMetadata": "Eintragsdaten",
    "editor.pageMetadata": "Seitendaten",
    "editor.pageTranscription": "Durchsuchbarer Seitentext",
    "editor.nothingSelected": "Nichts ausgewählt",
    "editor.selectPageForTranscription": "Wähle eine Seite aus, um ihren einzigen durchsuchbaren Text zu bearbeiten.",
    "editor.autosave": "Änderungen werden nach einer kurzen Pause automatisch gespeichert.",
    "field.title": "Titel",
    "field.entryType": "Eintragstyp",
    "field.dateFrom": "Datum von",
    "field.dateTo": "Datum bis",
    "field.datePrecision": "Datumsgenauigkeit",
    "field.languageOrSystem": "Sprache oder System",
    "field.tags": "Tags",
    "field.sourceForm": "Quellform",
    "field.status": "Status",
    "field.description": "Beschreibung",
    "field.notes": "Notizen",
    "field.canonicalPdf": "Haupt-PDF",
    "field.pageNumber": "Seitennummer",
    "field.pageLabel": "Seitenbezeichnung",
    "field.summary": "Zusammenfassung",
    "field.keywords": "Schlüsselwörter",
    "field.transcriptionStatus": "Transkriptionsstatus",
    "field.legibility": "Lesbarkeit",
    "field.containsSpecialGlyphs": "Enthält besondere Glyphen",
    "field.specialGlyphNote": "Hinweis zu besonderen Glyphen",
    "field.pageNotes": "Seitennotizen",
    "field.transcriptionText": "Durchsuchbarer Text",
    "button.choosePdf": "PDF auswählen",
    "button.createEntry": "Eintrag erstellen",
    "button.importResource": "Ressource importieren",
    "button.deleteResource": "Ressource löschen",
    "button.importing": "Import läuft...",
    "prompt.importExtract": "Klartext beim Import automatisch als Transkription übernehmen?",
    "prompt.transcriptionExists": "Es ist bereits eine Transkription vorhanden. Bitte wähle aus, wie fortgefahren werden soll",
    "option.saveResourceOnly": "Nur als Ressource speichern",
    "option.saveResourceAndExtract":
      "Als Ressource speichern und Klartext automatisch in die Transkription übernehmen",
    "option.replaceTranscription": "Vorhandene Transkription ersetzen",
    "option.appendTranscription": "An die vorhandene Transkription anhängen",
    "option.cancelInsertion": "Diesen Vorgang abbrechen",
    "notice.extractionSuccess": "Klartext wurde erfolgreich extrahiert",
    "notice.extractionFailed": "Aus dieser Datei konnte kein Klartext extrahiert werden",
    "notice.extractionUnsupported": "Für diesen Dateityp wird die automatische Extraktion derzeit nicht unterstützt",
    "hint.searchableTextOnly":
      "Dieses Feld speichert den einzigen durchsuchbaren Text der Seite. Es dient der Suche, Indizierung und schnellen Orientierung, nicht der Rekonstruktion der Originalformatierung. Verwende Platzhalter wie [G001] oder [UNK-1] für ungewöhnliche Glyphen.",
    "hint.resourcesRole":
      "Angehängte digitale Ressourcen werden hier als Zusatzmaterial angezeigt. Sie ersetzen nicht das Haupt-PDF im mittleren Lesebereich.",
    "resources.empty": "Für diesen Eintrag sind noch keine digitalen Ressourcen vorhanden.",
    "placeholder.entryTitle": "Titel des Eintrags",
    "placeholder.entryType": "Tagebuch, Manuskript, Auszug...",
    "placeholder.dateFrom": "JJJJ-MM-TT oder Freitext",
    "placeholder.optional": "Optional",
    "placeholder.languageOrSystem": "Chinesisch, gemischt, Conlang-Stufe...",
    "placeholder.tags": "Tags, durch Kommas getrennt",
    "placeholder.choosePdfFile": "PDF-Datei auswählen",
    "option.day": "Tag",
    "option.month": "Monat",
    "option.year": "Jahr",
    "option.approximate": "ungefähr",
    "option.unknown": "unbekannt",
    "option.none": "keine",
    "option.partial": "teilweise",
    "option.complete": "vollständig",
    "option.summaryOnly": "nur Zusammenfassung",
    "option.clear": "klar",
    "option.medium": "mittel",
    "option.difficult": "schwierig",
    "option.nearlyIllegible": "fast unleserlich",
    "confirm.deleteEntry": "Diesen Eintrag löschen und das verwaltete PDF in den Archivpapierkorb verschieben?",
    "result.matchedField.title": "Titel",
    "result.matchedField.description": "Beschreibung",
    "result.matchedField.entry_type": "Eintragstyp",
    "result.matchedField.tags_json": "Tags",
    "result.matchedField.language_or_system": "Sprache oder System",
    "result.matchedField.summary": "Zusammenfassung",
    "result.matchedField.keywords_json": "Schlüsselwörter",
    "result.matchedField.page_notes": "Seitennotizen",
    "result.matchedField.transcription_text": "durchsuchbarer Text",
    "result.matchedField.special_glyph_note": "Hinweis zu besonderen Glyphen",
  },
};
