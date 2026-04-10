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
  | "common.unknown"
  | "nav.searchPlaceholder"
  | "nav.metadataSearch"
  | "nav.fullTextSearch"
  | "nav.newEntry"
  | "nav.deleteEntry"
  | "nav.results"
  | "nav.matches"
  | "nav.pageResult"
  | "nav.entryResult"
  | "nav.timeUnknown"
  | "nav.empty"
  | "viewer.loadPdfPrompt"
  | "viewer.loadingPdf"
  | "viewer.unableToLoadPdf"
  | "viewer.previous"
  | "viewer.next"
  | "viewer.jump"
  | "viewer.fitWidth"
  | "viewer.fitPage"
  | "viewer.pageCounter"
  | "viewer.zoomHelp"
  | "viewer.zoomLabel"
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
  | "field.date"
  | "field.dateYear"
  | "field.dateMonth"
  | "field.dateDay"
  | "field.datePartMode"
  | "field.dateNote"
  | "field.tags"
  | "field.description"
  | "field.notes"
  | "field.canonicalPdf"
  | "field.pageNumber"
  | "field.pageLabel"
  | "field.pageOrder"
  | "field.sourcePdf"
  | "field.sourcePdfPage"
  | "field.originalPageNumber"
  | "field.summary"
  | "field.keywords"
  | "field.pageNotes"
  | "field.transcriptionText"
  | "button.choosePdf"
  | "button.createEntry"
  | "button.importResource"
  | "button.deleteResource"
  | "button.importPdfPages"
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
  | "placeholder.optional"
  | "placeholder.tags"
  | "placeholder.choosePdfFile"
  | "option.known"
  | "option.uncertain"
  | "option.notSet"
  | "confirm.deleteEntry"
  | "result.matchedField.title"
  | "result.matchedField.description"
  | "result.matchedField.entry_type"
  | "result.matchedField.tags_json"
  | "result.matchedField.summary"
  | "result.matchedField.keywords_json"
  | "result.matchedField.page_notes"
  | "result.matchedField.transcription_text";

export type TranslationValue = string | ((vars: Record<string, string | number>) => string);

export const translations: Record<Locale, Record<TranslationKey, TranslationValue>> = {
  "zh-TW": {
    "app.name": "個人手稿史料庫",
    "app.desktopArchive": "桌面史料庫",
    "app.language": "語言",
    "archive.localArchive": "本機史料庫",
    "archive.chooseRootTitle": "選擇史料庫根目錄",
    "archive.description":
      "請選擇一個史料庫根目錄。資料庫、受管檔案、縮圖、匯出與垃圾桶都會以可見的資料夾結構存放在其中。",
    "archive.opening": "正在開啟史料庫...",
    "archive.changeRoot": "更換史料庫根目錄",
    "archive.chooseRoot": "選擇史料庫根目錄",
    "dialog.newEntry": "新增條目",
    "dialog.createImportPdf": "建立條目並匯入 PDF 頁面來源",
    "common.close": "關閉",
    "common.cancel": "取消",
    "common.refresh": "重新整理",
    "common.searching": "搜尋中...",
    "common.page": "頁",
    "common.pages": "頁",
    "common.entry": "條目",
    "common.entries": "條目",
    "common.untitledPage": "未命名頁面",
    "common.unknown": "不確定",
    "nav.searchPlaceholder": "搜尋資訊或可檢索文本...",
    "nav.metadataSearch": "資訊搜尋",
    "nav.fullTextSearch": "全文搜尋",
    "nav.newEntry": "新增條目",
    "nav.deleteEntry": "刪除條目",
    "nav.results": "結果",
    "nav.matches": ({ count }) => `${count} 筆`,
    "nav.pageResult": "頁面結果",
    "nav.entryResult": "條目結果",
    "nav.timeUnknown": "時間不明",
    "nav.empty": "目前尚無條目",
    "viewer.loadPdfPrompt": "請先選取一個頁面以載入其來源 PDF。",
    "viewer.loadingPdf": "正在載入 PDF...",
    "viewer.unableToLoadPdf": ({ error }) => `無法載入 PDF：${error}`,
    "viewer.previous": "上一頁",
    "viewer.next": "下一頁",
    "viewer.jump": "跳至頁面",
    "viewer.fitWidth": "符合欄寬",
    "viewer.fitPage": "符合整頁",
    "viewer.pageCounter": ({ current, total }) => `第 ${current} / ${total} 頁`,
    "viewer.zoomHelp": "可用 Ctrl + 滾輪縮放",
    "viewer.zoomLabel": "縮放",
    "editor.editor": "編輯器",
    "editor.selectEntryOrPage": "請選取條目或頁面，以編輯資訊與可檢索文本。",
    "editor.inspector": "檢視器",
    "editor.metadata": "資訊",
    "editor.transcription": "轉寫",
    "editor.resources": "資源",
    "editor.entryMetadata": "條目資訊",
    "editor.pageMetadata": "頁面資訊",
    "editor.pageTranscription": "頁面可檢索文本",
    "editor.nothingSelected": "尚未選取",
    "editor.selectPageForTranscription": "請選取頁面，以編輯該頁唯一的可檢索文本。",
    "editor.autosave": "變更會在短暫停頓後自動儲存。",
    "field.title": "標題",
    "field.entryType": "條目類型",
    "field.date": "日期",
    "field.dateYear": "年",
    "field.dateMonth": "月",
    "field.dateDay": "日",
    "field.datePartMode": "日期狀態",
    "field.dateNote": "日期說明",
    "field.tags": "標籤",
    "field.description": "描述",
    "field.notes": "備註",
    "field.canonicalPdf": "來源 PDF",
    "field.pageNumber": "頁碼",
    "field.pageLabel": "頁面標籤",
    "field.pageOrder": "排序",
    "field.sourcePdf": "來源 PDF",
    "field.sourcePdfPage": "來源 PDF 頁碼",
    "field.originalPageNumber": "原始頁碼",
    "field.summary": "摘要",
    "field.keywords": "關鍵詞",
    "field.pageNotes": "頁面備註",
    "field.transcriptionText": "可檢索文本",
    "button.choosePdf": "選擇 PDF",
    "button.createEntry": "建立條目",
    "button.importResource": "匯入資源",
    "button.deleteResource": "刪除資源",
    "button.importPdfPages": "匯入 PDF 頁面",
    "button.importing": "處理中...",
    "prompt.importExtract": "匯入時是否自動抽取為轉寫",
    "prompt.transcriptionExists": "轉寫已存在，請選擇如何處理",
    "option.saveResourceOnly": "僅作為資源保存",
    "option.saveResourceAndExtract": "作為資源保存，並自動抽取純文本到轉寫",
    "option.replaceTranscription": "覆蓋現有轉寫",
    "option.appendTranscription": "追加到現有轉寫後面",
    "option.cancelInsertion": "取消本次寫入",
    "notice.extractionSuccess": "已成功抽取純文本",
    "notice.extractionFailed": "無法從該文件抽取純文本",
    "notice.extractionUnsupported": "此文件類型暫不支持自動抽取",
    "hint.searchableTextOnly":
      "這裡保存的是該頁唯一的可檢索文本，用於搜尋、索引與快速辨識內容，不用來重建原始格式。",
    "hint.resourcesRole": "附屬電子資源列於此處，可作為整理與比對材料，但不取代中欄主閱讀 PDF。",
    "resources.empty": "此條目尚無附屬電子資源",
    "placeholder.entryTitle": "條目標題",
    "placeholder.entryType": "日記、手稿、摘錄、書信、筆記……",
    "placeholder.optional": "可留空",
    "placeholder.tags": "以逗號分隔標籤",
    "placeholder.choosePdfFile": "選擇 PDF 檔案",
    "option.known": "具體值",
    "option.uncertain": "不確定",
    "option.notSet": "未設定",
    "confirm.deleteEntry": "要刪除此條目並將其受管檔案移到史料庫 trash/ 嗎？",
    "result.matchedField.title": "標題",
    "result.matchedField.description": "描述",
    "result.matchedField.entry_type": "條目類型",
    "result.matchedField.tags_json": "標籤",
    "result.matchedField.summary": "摘要",
    "result.matchedField.keywords_json": "關鍵詞",
    "result.matchedField.page_notes": "頁面備註",
    "result.matchedField.transcription_text": "可檢索文本",
  },
  en: {
    "app.name": "Personal Manuscript Archive",
    "app.desktopArchive": "Desktop Archive",
    "app.language": "Language",
    "archive.localArchive": "Local Archive",
    "archive.chooseRootTitle": "Choose Archive Root Folder",
    "archive.description":
      "Choose an archive root folder. The database, managed assets, thumbnails, exports, and trash will all be stored there in a visible folder structure.",
    "archive.opening": "Opening archive...",
    "archive.changeRoot": "Change Archive Root Folder",
    "archive.chooseRoot": "Choose Archive Root Folder",
    "dialog.newEntry": "New Entry",
    "dialog.createImportPdf": "Create Entry and Import PDF Source Pages",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.refresh": "Refresh",
    "common.searching": "Searching...",
    "common.page": "Page",
    "common.pages": "Pages",
    "common.entry": "Entry",
    "common.entries": "Entries",
    "common.untitledPage": "Untitled Page",
    "common.unknown": "Unknown",
    "nav.searchPlaceholder": "Search info or searchable text...",
    "nav.metadataSearch": "Info Search",
    "nav.fullTextSearch": "Full-Text Search",
    "nav.newEntry": "New Entry",
    "nav.deleteEntry": "Delete Entry",
    "nav.results": "Results",
    "nav.matches": ({ count }) => `${count} matches`,
    "nav.pageResult": "Page Result",
    "nav.entryResult": "Entry Result",
    "nav.timeUnknown": "Time Unknown",
    "nav.empty": "No entries yet",
    "viewer.loadPdfPrompt": "Select a page to load its source PDF.",
    "viewer.loadingPdf": "Loading PDF...",
    "viewer.unableToLoadPdf": ({ error }) => `Unable to load PDF: ${error}`,
    "viewer.previous": "Previous",
    "viewer.next": "Next",
    "viewer.jump": "Go to Page",
    "viewer.fitWidth": "Fit Width",
    "viewer.fitPage": "Fit Page",
    "viewer.pageCounter": ({ current, total }) => `Page ${current} / ${total}`,
    "viewer.zoomHelp": "Use Ctrl + mouse wheel to zoom",
    "viewer.zoomLabel": "Zoom",
    "editor.editor": "Editor",
    "editor.selectEntryOrPage": "Select an entry or page to edit archive info and searchable text.",
    "editor.inspector": "Inspector",
    "editor.metadata": "Info",
    "editor.transcription": "Transcription",
    "editor.resources": "Resources",
    "editor.entryMetadata": "Entry Info",
    "editor.pageMetadata": "Page Info",
    "editor.pageTranscription": "Page Searchable Text",
    "editor.nothingSelected": "Nothing Selected",
    "editor.selectPageForTranscription": "Select a page to edit that page's single searchable text.",
    "editor.autosave": "Changes are saved automatically after a short pause.",
    "field.title": "Title",
    "field.entryType": "Entry Type",
    "field.date": "Date",
    "field.dateYear": "Year",
    "field.dateMonth": "Month",
    "field.dateDay": "Day",
    "field.datePartMode": "Date Mode",
    "field.dateNote": "Date Note",
    "field.tags": "Tags",
    "field.description": "Description",
    "field.notes": "Notes",
    "field.canonicalPdf": "Source PDF",
    "field.pageNumber": "Page Number",
    "field.pageLabel": "Page Label",
    "field.pageOrder": "Sort Order",
    "field.sourcePdf": "Source PDF",
    "field.sourcePdfPage": "Source PDF Page",
    "field.originalPageNumber": "Original Page Number",
    "field.summary": "Summary",
    "field.keywords": "Keywords",
    "field.pageNotes": "Page Notes",
    "field.transcriptionText": "Searchable Text",
    "button.choosePdf": "Choose PDF",
    "button.createEntry": "Create Entry",
    "button.importResource": "Import Resource",
    "button.deleteResource": "Delete Resource",
    "button.importPdfPages": "Import PDF Pages",
    "button.importing": "Working...",
    "prompt.importExtract": "Extract as transcription automatically during import?",
    "prompt.transcriptionExists": "A transcription already exists. Please choose how to proceed",
    "option.saveResourceOnly": "Save as resource only",
    "option.saveResourceAndExtract": "Save as resource and automatically extract plain text into transcription",
    "option.replaceTranscription": "Replace existing transcription",
    "option.appendTranscription": "Append to existing transcription",
    "option.cancelInsertion": "Cancel this insertion",
    "notice.extractionSuccess": "Plain text extracted successfully",
    "notice.extractionFailed": "Unable to extract plain text from this file",
    "notice.extractionUnsupported": "Automatic extraction is not supported for this file type yet",
    "hint.searchableTextOnly":
      "This field stores the page's single searchable text for search, indexing, and fast recognition, not for reconstructing original formatting.",
    "hint.resourcesRole": "Attached digital resources are listed here for reference and extraction work, but they do not replace the main reading PDF.",
    "resources.empty": "No attached digital resources for this entry yet",
    "placeholder.entryTitle": "Entry title",
    "placeholder.entryType": "Diary, manuscript, excerpt, letter, notes...",
    "placeholder.optional": "Optional",
    "placeholder.tags": "Comma-separated tags",
    "placeholder.choosePdfFile": "Choose a PDF file",
    "option.known": "Known",
    "option.uncertain": "Uncertain",
    "option.notSet": "Not set",
    "confirm.deleteEntry": "Delete this entry and move its managed files into trash/?",
    "result.matchedField.title": "Title",
    "result.matchedField.description": "Description",
    "result.matchedField.entry_type": "Entry Type",
    "result.matchedField.tags_json": "Tags",
    "result.matchedField.summary": "Summary",
    "result.matchedField.keywords_json": "Keywords",
    "result.matchedField.page_notes": "Page Notes",
    "result.matchedField.transcription_text": "Searchable Text",
  },
  de: {
    "app.name": "Persönliches Handschriftenarchiv",
    "app.desktopArchive": "Desktop-Archiv",
    "app.language": "Sprache",
    "archive.localArchive": "Lokales Archiv",
    "archive.chooseRootTitle": "Archivwurzel auswählen",
    "archive.description":
      "Wähle einen Archivordner aus. Datenbank, verwaltete Dateien, Vorschaubilder, Exporte und Papierkorb werden dort in einer sichtbaren Ordnerstruktur gespeichert.",
    "archive.opening": "Archiv wird geöffnet...",
    "archive.changeRoot": "Archivwurzel ändern",
    "archive.chooseRoot": "Archivwurzel auswählen",
    "dialog.newEntry": "Neuer Eintrag",
    "dialog.createImportPdf": "Eintrag anlegen und PDF-Quellseiten importieren",
    "common.close": "Schließen",
    "common.cancel": "Abbrechen",
    "common.refresh": "Aktualisieren",
    "common.searching": "Suche läuft...",
    "common.page": "Seite",
    "common.pages": "Seiten",
    "common.entry": "Eintrag",
    "common.entries": "Einträge",
    "common.untitledPage": "Unbenannte Seite",
    "common.unknown": "Unbekannt",
    "nav.searchPlaceholder": "Informationen oder durchsuchbaren Text suchen...",
    "nav.metadataSearch": "Infosuche",
    "nav.fullTextSearch": "Volltextsuche",
    "nav.newEntry": "Neuer Eintrag",
    "nav.deleteEntry": "Eintrag löschen",
    "nav.results": "Ergebnisse",
    "nav.matches": ({ count }) => `${count} Treffer`,
    "nav.pageResult": "Seitentreffer",
    "nav.entryResult": "Eintragstreffer",
    "nav.timeUnknown": "Zeit unklar",
    "nav.empty": "Noch keine Einträge",
    "viewer.loadPdfPrompt": "Wähle eine Seite aus, um ihr Quell-PDF zu laden.",
    "viewer.loadingPdf": "PDF wird geladen...",
    "viewer.unableToLoadPdf": ({ error }) => `PDF konnte nicht geladen werden: ${error}`,
    "viewer.previous": "Zurück",
    "viewer.next": "Weiter",
    "viewer.jump": "Zu Seite",
    "viewer.fitWidth": "An Breite anpassen",
    "viewer.fitPage": "An Seite anpassen",
    "viewer.pageCounter": ({ current, total }) => `Seite ${current} / ${total}`,
    "viewer.zoomHelp": "Mit Strg + Mausrad zoomen",
    "viewer.zoomLabel": "Zoom",
    "editor.editor": "Editor",
    "editor.selectEntryOrPage": "Wähle einen Eintrag oder eine Seite aus, um Archivdaten und durchsuchbaren Text zu bearbeiten.",
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
    "field.date": "Datum",
    "field.dateYear": "Jahr",
    "field.dateMonth": "Monat",
    "field.dateDay": "Tag",
    "field.datePartMode": "Datumsmodus",
    "field.dateNote": "Datumsnotiz",
    "field.tags": "Schlagwörter",
    "field.description": "Beschreibung",
    "field.notes": "Notizen",
    "field.canonicalPdf": "Quell-PDF",
    "field.pageNumber": "Seitennummer",
    "field.pageLabel": "Seitenlabel",
    "field.pageOrder": "Reihenfolge",
    "field.sourcePdf": "Quell-PDF",
    "field.sourcePdfPage": "PDF-Seitenindex",
    "field.originalPageNumber": "Ursprüngliche Seitenzahl",
    "field.summary": "Zusammenfassung",
    "field.keywords": "Stichwörter",
    "field.pageNotes": "Seitennotizen",
    "field.transcriptionText": "Durchsuchbarer Text",
    "button.choosePdf": "PDF auswählen",
    "button.createEntry": "Eintrag anlegen",
    "button.importResource": "Ressource importieren",
    "button.deleteResource": "Ressource löschen",
    "button.importPdfPages": "PDF-Seiten importieren",
    "button.importing": "Wird verarbeitet...",
    "prompt.importExtract": "Klartext beim Import automatisch als Transkription übernehmen?",
    "prompt.transcriptionExists": "Es ist bereits eine Transkription vorhanden. Bitte wähle aus, wie fortgefahren werden soll",
    "option.saveResourceOnly": "Nur als Ressource speichern",
    "option.saveResourceAndExtract": "Als Ressource speichern und Klartext automatisch in die Transkription übernehmen",
    "option.replaceTranscription": "Vorhandene Transkription ersetzen",
    "option.appendTranscription": "An die vorhandene Transkription anhängen",
    "option.cancelInsertion": "Diesen Vorgang abbrechen",
    "notice.extractionSuccess": "Klartext wurde erfolgreich extrahiert",
    "notice.extractionFailed": "Aus dieser Datei konnte kein Klartext extrahiert werden",
    "notice.extractionUnsupported": "Für diesen Dateityp wird die automatische Extraktion derzeit nicht unterstützt",
    "hint.searchableTextOnly":
      "Dieses Feld speichert den einzigen durchsuchbaren Text der Seite für Suche, Indexierung und schnelle Orientierung, nicht zur Rekonstruktion des ursprünglichen Layouts.",
    "hint.resourcesRole": "Angehängte digitale Ressourcen werden hier als Hilfsmaterial geführt, ersetzen aber nicht das zentrale Lese-PDF.",
    "resources.empty": "Für diesen Eintrag sind noch keine digitalen Ressourcen vorhanden",
    "placeholder.entryTitle": "Titel des Eintrags",
    "placeholder.entryType": "Tagebuch, Manuskript, Exzerpt, Brief, Notizen...",
    "placeholder.optional": "Optional",
    "placeholder.tags": "Kommagetrennte Schlagwörter",
    "placeholder.choosePdfFile": "PDF-Datei auswählen",
    "option.known": "Bekannt",
    "option.uncertain": "Unsicher",
    "option.notSet": "Nicht gesetzt",
    "confirm.deleteEntry": "Diesen Eintrag löschen und seine verwalteten Dateien nach trash/ verschieben?",
    "result.matchedField.title": "Titel",
    "result.matchedField.description": "Beschreibung",
    "result.matchedField.entry_type": "Eintragstyp",
    "result.matchedField.tags_json": "Schlagwörter",
    "result.matchedField.summary": "Zusammenfassung",
    "result.matchedField.keywords_json": "Stichwörter",
    "result.matchedField.page_notes": "Seitennotizen",
    "result.matchedField.transcription_text": "Durchsuchbarer Text",
  },
};
