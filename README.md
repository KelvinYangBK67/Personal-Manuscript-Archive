# Personal Manuscript Archive

[繁體中文說明 / README_zh](README_zh.md)

Personal Manuscript Archive is a local desktop archive workstation for preserving and working with personal manuscript materials. It treats the entry as the cataloging unit, the page as the core operational unit, and the PDF as a source reading surface rather than as the whole archive model.

The app keeps original files visible inside a user-chosen archive root, stores page-level searchable text separately, and provides GUI tools for metadata, transcription, attached resources, search, and PDF reading.

This project was implemented with assistance from Codex.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for the full text.

## Current Features

- Choose an archive root folder from the GUI.
- Create the archive folder structure automatically.
- Create empty entries first, without requiring a PDF.
- Import PDF pages into an existing entry after the entry is created.
- Batch import `pdf`, `txt`, `md`, `docx`, and `tex` files, creating entries from file names.
- Treat pages as the main operational units inside entries.
- Support page ordering, page movement, page copying, and page removal from entries.
- Allow entries to contain pages sourced from more than one PDF.
- Generate stable sequential IDs for entries, pages, and attached resources.
- Use a three-pane desktop layout: catalog tree/search, PDF reader, and metadata/transcription/resources editor.
- Browse entries in a five-level catalog tree: entry type, year, month, entry, page.
- Expand all catalog groups down to entries while keeping page lists collapsed; only one entry page list can be expanded at a time.
- Edit entry metadata and page metadata with autosave.
- Edit page-level searchable text used for full-text search.
- View PDFs inside the desktop app with page jump, fit-width, fit-page, direct zoom, and Ctrl + wheel zoom.
- Show a text reading view in the middle pane for pages that have searchable text but no source PDF.
- Import attached digital resources into the archive.
- Import `txt`, `md`, `docx`, and `tex` resources with an optional plain-text extraction flow.
- Choose whether extracted plain text should replace or append to the current page transcription.
- Keep imported source files in the resource list while still using `transcription_text` as the single searchable text.
- Delete entries and resources with soft-delete behavior by moving managed files into `trash/`.
- Search metadata and searchable text from the left pane with matched-field labels and highlighted snippets.
- Switch the UI language between 繁體中文, English, and Deutsch.

## Search Syntax

The left pane has separate metadata and full-text search modes:

- Metadata search checks entry title, entry type, description, tags, summary, keywords, and page notes.
- Full-text search checks page `transcription_text`, plus page summary and page notes.
- Search terms can be plain words or quoted phrases, such as `sanskrit` or `"socialist china"`.
- Operators work outside quotes: `AND`, `OR`, `NOT`, `NAND`, `NOR`, and `XOR`.
- Quoted text is literal, so `"A AND B"` searches for that phrase instead of treating `AND` as an operator.

## TeX Extraction

`.tex` files can be imported as attached digital resources and may optionally be extracted into the page transcription.

The TeX extractor is intentionally conservative:

- It prefers content between `\begin{document}` and `\end{document}`.
- If no document environment exists, it processes the whole file.
- It removes real TeX comments while preserving escaped `\%`.
- It keeps inline math such as `$...$` and `\(...\)` as original TeX source.
- It keeps display math such as `$$...$$`, `\[...\]`, and common math environments such as `equation`, `align`, `gather`, `multline`, and `cases`.
- It simplifies common formatting commands such as `\textbf{...}` and `\emph{...}` by keeping their text content.
- It turns section-like commands into plain text headings.
- It keeps list item text from `itemize`, `enumerate`, and `description`.
- It keeps footnote content as inline note text.
- Unknown one-argument commands are degraded conservatively by keeping their braced text content when possible.

The extractor does not compile TeX, expand multi-file projects, evaluate custom macros, or attempt to render formulas. Its goal is a readable and searchable draft text for later manual correction.

## Tech Stack

- Tauri 2
- React
- TypeScript
- SQLite via `rusqlite`
- PDF.js via `pdfjs-dist`
- Rust backend for archive, file, PDF import, and text extraction logic

## Archive Structure

The archive root is user-chosen and remains visible on disk.

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

## Development

Requirements on Windows:

- Node.js 20+
- Rust toolchain
- Tauri Windows prerequisites

Run the desktop app in development mode:

```powershell
.\scripts\run_dev.bat
```

## Packaging

Build Windows installers:

```powershell
.\scripts\build_exe.bat
```

The build script will:

- install frontend dependencies if needed
- run `tauri build`
- create installer outputs under `src-tauri\target\release\bundle\`
- create a versioned ZIP bundle based on the `package.json` version

Example ZIP naming pattern:

```text
PersonalManuscriptArchive_v0.1.0_windows_x64.zip
```

## Project Structure

- `src/` React frontend
- `src-tauri/` Tauri and Rust backend
- `scripts/` local Windows helper scripts
- `README.md` English documentation
- `README_zh.md` Traditional Chinese documentation
- `LICENSE` MIT license text
