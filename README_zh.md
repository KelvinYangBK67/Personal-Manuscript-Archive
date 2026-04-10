# Personal Manuscript Archive

[English README](README.md)

Personal Manuscript Archive 是一個本機桌面檔案工作臺，用來整理與保存你自己的舊稿、手稿、設定稿與其他書寫材料。
它以 PDF 作為主閱讀載體，將每頁的可檢索文本獨立保存，並在同一個 GUI 中處理 metadata、轉寫與附屬電子資源。

本專案由 Codex 協助實作與整理文件。

## 授權

本專案採用 MIT License。
完整內容請見 [LICENSE](LICENSE)。

## 目前功能

- 可從 GUI 選擇 archive root
- 自動建立 archive 資料夾結構
- 每個條目可保存一份 canonical PDF，存放於 `assets/pdfs/`
- 為條目、頁面與附屬資源生成穩定遞增 ID
- 匯入 PDF 時自動依頁數建立 page records
- 三欄式桌面工作區：
  左側導覽/搜尋、中間 PDF 閱讀器、右側資訊/轉寫/資源
- 條目與頁面 metadata 可自動儲存
- 可編輯每頁唯一的可檢索文本 `transcription_text`
- 內建 PDF 檢視、跳頁與縮放
- 可匯入附屬電子資源到 archive
- 匯入 `txt`、`md`、`docx` 時，可選擇是否自動抽取純文本作為轉寫初稿
- 若當前頁已有轉寫，可選擇覆蓋或追加，不會默默覆蓋
- 原始電子資源仍保留在資源列表中，搜尋仍以 `transcription_text` 為唯一可檢索文本
- 刪除條目或資源時採 soft delete，受管檔案會移到 `trash/`
- 左欄可搜尋 metadata 與可檢索文本
- 支援繁體中文、English、Deutsch 三種介面語言

## 技術棧

- Tauri 2
- React
- TypeScript
- SQLite（`rusqlite`）
- PDF.js（`pdfjs-dist`）
- Rust 後端負責 archive、檔案與純文本抽取邏輯

## Archive 結構

Archive root 由使用者自行指定，資料在磁碟上保持可見。

```text
ArchiveRoot/
  archive.db
  assets/
    pdfs/
    images/
    resources/
  thumbs/
  exports/
  trash/
  config/
```

## 開發

Windows 需求：

- Node.js 20+
- Rust toolchain
- Tauri Windows prerequisites

開發模式啟動：

```powershell
.\scripts\run_dev.bat
```

## 打包

建立 Windows 安裝包：

```powershell
.\scripts\build_exe.bat
```

腳本會：

- 視需要安裝前端依賴
- 執行 `tauri build`
- 將安裝包輸出到 `src-tauri\target\release\bundle\`
- 依 `package.json` 版本號建立一個帶版本號的 ZIP 壓縮包

ZIP 檔命名範例：

```text
PersonalManuscriptArchive_v0.1.0_windows_x64.zip
```

## 專案結構

- `src/` React 前端
- `src-tauri/` Tauri / Rust 後端
- `scripts/` 本機 Windows 輔助腳本
- `README.md` 英文說明
- `README_zh.md` 繁體中文說明
- `LICENSE` MIT 授權
