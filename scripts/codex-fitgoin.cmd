@echo off
setlocal
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if not defined HOME set "HOME=%USERPROFILE%"
set "CODEX_CMD=%APPDATA%\npm\codex.cmd"
if not exist "%CODEX_CMD%" (
  echo ERROR: Codex CLI is not installed.
  exit /b 2
)
for /f "tokens=2" %%V in ('call "%CODEX_CMD%" --version') do set "CODEX_VERSION=%%V"
if /I not "%CODEX_VERSION%"=="0.154.0" (
  echo ERROR: Expected Codex CLI 0.154.0, found %CODEX_VERSION%.
  echo This project is temporarily pinned because newer Windows builds hit a sandbox runtime-path regression.
  exit /b 3
)
call "%CODEX_CMD%" %*
exit /b %ERRORLEVEL%
