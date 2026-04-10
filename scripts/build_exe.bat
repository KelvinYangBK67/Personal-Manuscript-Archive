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

echo Installing frontend dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed.
  pause
  popd
  exit /b 1
)

echo Building Windows executable bundle...
call npm run tauri:build
if errorlevel 1 (
  echo.
  echo tauri build failed.
  pause
  popd
  exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content package.json -Raw | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"
set "BUNDLE_DIR=%CD%\src-tauri\target\release\bundle"
set "ZIP_NAME=PersonalManuscriptArchive_v%APP_VERSION%_windows_x64.zip"

if exist "%BUNDLE_DIR%\%ZIP_NAME%" del "%BUNDLE_DIR%\%ZIP_NAME%"

echo Creating versioned ZIP bundle...
powershell -NoProfile -Command "Compress-Archive -Path '%BUNDLE_DIR%\msi\*','%BUNDLE_DIR%\nsis\*' -DestinationPath '%BUNDLE_DIR%\%ZIP_NAME%' -Force"
if errorlevel 1 (
  echo.
  echo Failed to create the versioned ZIP bundle.
  pause
  popd
  exit /b 1
)

echo.
echo Build completed. Check src-tauri\target\release\bundle\
echo ZIP bundle: src-tauri\target\release\bundle\%ZIP_NAME%
pause
popd
exit /b 0
