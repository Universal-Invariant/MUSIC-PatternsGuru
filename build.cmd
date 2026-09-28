@echo off
REM MUSIC-PatternsGuru - one-shot build & verify script for Windows.
REM Usage:  build.cmd          -> install (if needed), typecheck, test, build web app
REM         build.cmd dev      -> start the Vite dev server (http://localhost:5173)
setlocal

if "%~1"=="dev" (
  call npm run dev
  exit /b %ERRORLEVEL%
)

echo [1/4] Installing dependencies...
if not exist node_modules (
  call npm install
  if errorlevel 1 goto :fail
)

echo [2/4] Type-checking all projects (tsc -b)...
call npx tsc -b --force
if errorlevel 1 goto :fail

echo [3/4] Running tests...
call npm test
if errorlevel 1 goto :fail

echo [4/4] Building web app...
call npm run build --workspace web
if errorlevel 1 goto :fail

echo.
echo BUILD OK. Run "build.cmd dev" or "npm run dev" to start the playground.
exit /b 0

:fail
echo.
echo BUILD FAILED (exit code %ERRORLEVEL%).
exit /b 1
