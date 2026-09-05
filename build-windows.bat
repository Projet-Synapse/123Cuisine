@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 123Cuisine - Construction de l'installeur Windows
cd /d "%~dp0"

echo ════════════════════════════════════════════════════════════
echo   123Cuisine — Construction de l'installeur Windows (.exe)
echo ════════════════════════════════════════════════════════════
echo.

REM ── 1. Localiser Node.js (installé en dur, ou copie portable fournie) ──
where node >nul 2>nul
if %errorlevel%==0 goto :node_ok
if exist "C:\AI\creation logiciel\node-portable\node.exe" (
    set "PATH=C:\AI\creation logiciel\node-portable;%PATH%"
    goto :node_ok
)
echo [ERREUR] Node.js introuvable. Installez Node.js 20 ou plus :
echo          https://nodejs.org (ou décompressez une archive ZIP dans
echo          "C:\AI\creation logiciel\node-portable").
exit /b 1
:node_ok
echo [1/6] Node.js trouvé : 
node --version

REM ── 2. pnpm (gestionnaire de paquets du projet) ──
where pnpm >nul 2>nul
if %errorlevel%==0 goto :pnpm_ok
corepack enable pnpm >nul 2>nul
corepack prepare pnpm@10 --activate >nul 2>nul
where pnpm >nul 2>nul
if %errorlevel%==0 goto :pnpm_ok
echo [ERREUR] pnpm introuvable et corepack n'a pas pu l'activer.
exit /b 1
:pnpm_ok
echo [2/6] pnpm trouvé :
pnpm --version

REM ── 3. Dépendances ──
if exist "node_modules\.pnpm" goto :deps_ok
echo [3/6] Installation des dépendances (plusieurs minutes au premier lancement)...
call pnpm install --frozen-lockfile
if not %errorlevel%==0 exit /b 1
:deps_ok
echo [3/6] Dépendances présentes.

REM ── 4. Binaire Electron (téléchargé par le postinstall, parfois bloqué) ──
if exist "node_modules\electron\dist\electron.exe" goto :electron_ok
echo [4/6] Téléchargement du runtime Electron...
node node_modules\electron\install.js
if not %errorlevel%==0 exit /b 1
:electron_ok
echo [4/6] Runtime Electron présent.

REM ── 5. Garde-fous puis construction ──
echo [5/6] Vérifications (Supabase, types) puis construction...
node scripts\check-supabase-env.mjs --live
if not %errorlevel%==0 exit /b 1
npx tsc --noEmit
if not %errorlevel%==0 exit /b 1
call npx expo export --platform web
if not %errorlevel%==0 exit /b 1
call npx electron-builder --win --publish never
if not %errorlevel%==0 exit /b 1

REM ── 6. Copie du résultat ──
set "OUT_DIR=%~dp0..\..\fichiers-installation"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
copy /y "dist_electron\123Cuisine.exe" "%OUT_DIR%\123Cuisine-Setup-windows.exe" >nul
echo [6/6] Installeur copié dans "%OUT_DIR%".

echo.
echo ✅ TERMINÉ — installeur Windows : fichiers-installation\123Cuisine-Setup-windows.exe
echo    Double-cliquez dessus pour installer l'application.
endlocal
