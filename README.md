# Personal Manuscript Archive

[中文說明 / README_zh](README_zh.md)

Personal Manuscript Archive is a local desktop archive workstation for preserving your own written materials.
It keeps the PDF as the primary reading surface, stores page-level searchable text separately, and lets you manage metadata, transcription, and attached digital resources in one GUI.

This project was implemented with assistance from Codex.

## License

This project is released under the MIT License.
See [LICENSE](LICENSE) for the full text.

## Current Features

- Select an archive root folder from the GUI
- Create the archive folder structure automatically
- Store a canonical PDF per entry under `assets/pdfs/`
- Generate stable sequential IDs for entries, pages, and attached resources
- Create one page record per PDF page automatically
- Use a three-pane desktop layout:
  navigation/search, PDF reader, metadata/transcription/resources editor
- Edit entry metadata and page metadata with autosave
- Edit the page-level searchable text used for full-text search
- View PDFs inside the desktop app with page jump and zoom controls
- Import attached digital resources into the archive
- Import `txt`, `md`, and `docx` resources with an optional plain-text extraction flow
- Choose whether extracted plain text should replace or append to the current page transcription
- Keep imported source files in the resource list while still using `transcription_text` as the single searchable text
- Delete entries and resources with soft-delete behavior by moving managed files into `trash/`
- Search metadata and searchable text from the left pane
- Switch the UI language between Traditional Chinese, English, and German

## Tech Stack

- Tauri 2
- React
- TypeScript
- SQLite via `rusqlite`
- PDF.js via `pdfjs-dist`
- Rust backend for archive, file, and extraction logic

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
- create the installer outputs under `src-tauri\target\release\bundle\`
- create a versioned ZIP bundle based on `package.json` version

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
