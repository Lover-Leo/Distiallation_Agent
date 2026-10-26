@echo off
setlocal
cd /d "%~dp0"
set "STYLE_AGENT_NODE="
where node.exe >nul 2>nul
if not errorlevel 1 set "STYLE_AGENT_NODE=node.exe"
if defined STYLE_AGENT_NODE goto run
set "STYLE_AGENT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%STYLE_AGENT_NODE%" goto run
echo Node.js 22 or newer was not found. Install Node.js and try again.
pause
exit /b 1
:run
"%STYLE_AGENT_NODE%" "%~dp0scripts\quick-start.mjs" %*
set "STYLE_AGENT_EXIT=%ERRORLEVEL%"
if not "%STYLE_AGENT_EXIT%"=="0" pause
exit /b %STYLE_AGENT_EXIT%
