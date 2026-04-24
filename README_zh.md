# Personal Manuscript Archive

[English README](README.md)

Personal Manuscript Archive 是一個本機桌面史料庫工作臺，用於保存、整理與檢索個人手稿、舊稿、筆記和其他書寫材料。它把「條目」作為編目單位，把「頁面」作為基本操作單元，把 PDF 視為原始閱讀載體，而不是把整個系統做成單純的 PDF 管理器。

應用會把原始檔案保存在使用者指定的 archive root 裡，讓資料在檔案系統中保持可見；同時把每頁可檢索文本獨立存入資料庫，便於搜尋、快速辨認與後續人工修正。

本專案由 Codex 協助實作與整理文件。

## 授權

本專案使用 MIT License。完整內容請見 [LICENSE](LICENSE)。

## 目前功能

- 可在 GUI 中選擇 archive root。
- 自動建立 archive 資料夾結構。
- 可先建立空條目，不必先綁定 PDF。
- 建立條目後，可再把 PDF 頁面匯入該條目。
- 可批量匯入 `pdf`、`txt`、`md`、`docx`、`tex` 檔案，系統會以檔名建立條目。
- 以頁面作為條目內的基本操作單元。
- 支持頁面排序、移動、複製與從條目中移除。
- 一個條目可以包含來自多個 PDF 的頁面。
- 為條目、頁面與附屬資源生成穩定遞增 ID。
- 使用三欄式桌面佈局：左欄編目樹與搜尋，中欄 PDF 閱讀器，右欄資訊 / 轉寫 / 資源編輯器。
- 左欄使用五級編目樹：條目類型、年、月、條目、頁面。
- 「展開全部」會展開到條目層；頁面列表一次最多只展開一個條目。
- 條目資訊與頁面資訊支援自動保存。
- 可編輯每頁的唯一可檢索文本，用於全文搜尋。
- 內建 PDF 閱讀，可跳頁、符合欄寬、符合整頁、直接輸入縮放倍率，也支援 Ctrl + 滾輪縮放。
- 沒有來源 PDF 的頁面會在中欄顯示其可檢索文本，作為文字閱讀視圖。
- 可將附屬電子資源匯入 archive。
- 匯入 `txt`、`md`、`docx`、`tex` 時，可選擇是否自動抽取純文本作為轉寫初稿。
- 若目前頁面已有轉寫，可選擇覆蓋或追加，不會靜默覆蓋。
- 原始電子資源會保留在「資源」列表中；搜尋仍以 `transcription_text` 作為唯一可檢索正文。
- 刪除條目或資源時採用 soft delete，受管檔案會移到 `trash/`。
- 左欄可搜尋資訊與可檢索文本，結果會顯示匹配欄位與高亮片段。
- 支援繁體中文、English、Deutsch 三種介面語言。

## 搜尋語法

左欄搜尋分為「資訊搜尋」與「全文搜尋」兩種模式：

- 資訊搜尋會比對條目標題、條目類型、描述、標籤、摘要、關鍵詞與頁面備註等欄位。
- 全文搜尋會比對頁面的 `transcription_text`，並一併納入頁面摘要與頁面備註。
- 單字或引號片語都可搜尋，例如 `sanskrit`、`"socialist china"`。
- 可在引號外使用 `AND`、`OR`、`NOT`、`NAND`、`NOR`、`XOR`，例如 `"A" AND "B"`、`"A" AND NOT "B"`。
- 引號內的內容會被視為字面量；例如 `"A AND B"` 搜尋的是完整片語，不會把 `AND` 當成運算符。

## TeX 抽取

`.tex` 檔案可以作為附屬電子資源匯入，也可以選擇自動抽取純文本並寫入當前頁面的轉寫。

TeX 抽取器採取保守策略：

- 優先抽取 `\begin{document}` 與 `\end{document}` 之間的內容。
- 如果沒有 document 環境，則處理整個檔案。
- 去除真正的 TeX 註釋，同時保留轉義的 `\%`。
- 行內公式如 `$...$`、`\(...\)` 會保留原始 TeX 源碼。
- 展示公式如 `$$...$$`、`\[...\]`，以及 `equation`、`align`、`gather`、`multline`、`cases` 等常見數學環境會保留原始 TeX 源碼。
- 常見格式命令如 `\textbf{...}`、`\emph{...}` 會去掉命令本身，保留其中的文字。
- `\section{...}`、`\subsection{...}` 等結構命令會轉成普通文字標題。
- `itemize`、`enumerate`、`description` 中的 `\item` 會轉成普通列表項。
- `\footnote{...}` 會保留為內聯註記文字。
- 未知的一元命令會盡量保留花括號中的文本內容。

抽取器不會編譯 TeX、不會展開多檔工程、不會執行自定義宏，也不會渲染或語義化數學公式。目標是生成一份可讀、可搜尋、方便後續人工修正的轉寫初稿。

## 技術棧

- Tauri 2
- React
- TypeScript
- SQLite via `rusqlite`
- PDF.js via `pdfjs-dist`
- Rust 後端負責 archive、檔案、PDF 匯入與純文本抽取邏輯

## Archive 結構

Archive root 由使用者指定，資料在磁碟上保持可見。

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

啟動開發模式：

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
- 根據 `package.json` 版本建立帶版本號的 ZIP

ZIP 命名範例：

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
