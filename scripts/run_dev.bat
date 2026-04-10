@echo off
setlocal

pushd "%~dp0\.."

set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"
set "RUSTUP_HOME=%CD%\.rustup"
set "CARGO_HOME=%CD%\.cargo"

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
