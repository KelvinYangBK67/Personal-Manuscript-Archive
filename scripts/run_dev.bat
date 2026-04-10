@echo off
setlocal

pushd "%~dp0\.."

set "PATH=C:\Program Files\nodejs;%CD%\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;%USERPROFILE%\.cargo\bin;%PATH%"
set "RUSTUP_HOME=%CD%\.rustup"
set "CARGO_HOME=%CD%\.cargo"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"
set "TEMP=%CD%\src-tauri\target\tmp"
set "TMP=%CD%\src-tauri\target\tmp"

if not exist "%TEMP%" mkdir "%TEMP%"
powershell -NoProfile -Command "if (Test-Path 'src-tauri\target') { Get-ChildItem 'src-tauri\target' -Directory -Recurse -Force | ForEach-Object { $_.Attributes = ($_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)) }; (Get-Item 'src-tauri\target').Attributes = ([System.IO.FileAttributes]::Directory -bor [System.IO.FileAttributes]::NotContentIndexed) }"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo.
  echo Install Node.js 20+ and reopen the terminal.
  pause
  popd
  exit /b 1
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust/Cargo is not installed or not on PATH.
  echo.
  echo Install Rust via rustup and reopen the terminal.
  pause
  popd
  exit /b 1
)

if not exist node_modules (
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    popd
    exit /b 1
  )
)

call npm run tauri:dev
if errorlevel 1 (
  echo.
  echo tauri dev failed.
  pause
  popd
  exit /b 1
)

pause
popd
exit /b 0
