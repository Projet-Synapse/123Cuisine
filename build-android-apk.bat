@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 123Cuisine - Construction de l'APK Android
cd /d "%~dp0"

echo ════════════════════════════════════════════════════════════
echo   123Cuisine — Construction de l'APK Android (.apk)
echo ════════════════════════════════════════════════════════════
echo.
echo IMPORTANT : ce projet est situe dans un chemin contenant un espace
echo ("C:\AI\creation logiciel"). La toolchain Android (CMake/Ninja de
echo Reanimated, hermesc) ne supporte pas cela. Le script construit donc
echo l'APK depuis une copie du projet dans "C:\123Cuisine" (sans espace).
echo.

REM ── Outils locaux : adapter ces chemins si besoin ───────────────
if "%NODE_DIR%"=="" set "NODE_DIR=C:\AI\creation logiciel\node-portable"
if "%JAVA_HOME%"=="" set "JAVA_HOME=C:\AI\creation logiciel\jdk17"
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=C:\Android\Sdk"
if "%BUILD_DIR%"=="" set "BUILD_DIR=C:\123Cuisine"

if not exist "%JAVA_HOME%\bin\java.exe" (
    echo [ERREUR] JDK 17 introuvable dans "%JAVA_HOME%".
    echo          Installez Eclipse Temurin JDK 17 et/ou adaptez JAVA_HOME.
    exit /b 1
)
if not exist "%ANDROID_HOME%\platform-tools" (
    echo [ERREUR] SDK Android introuvable dans "%ANDROID_HOME%".
    echo          Installez cmdline-tools puis : sdkmanager "platform-tools"
    echo          "platforms;android-35" "build-tools;35.0.0" "ndk;27.1.12297006"
    echo          et acceptez les licences ^(sdkmanager --licenses^).
    exit /b 1
)
if not exist "%NODE_DIR%\node.exe" (
    echo [ERREUR] Node.js introuvable dans "%NODE_DIR%".
    echo          Installez Node.js 20+ et/ou adaptez NODE_DIR.
    exit /b 1
)
set "PATH=%JAVA_HOME%\bin;%NODE_DIR%;%PATH%"
echo [1/6] Outils : Node OK, JDK 17 OK, SDK Android OK.

REM ── 2. Synchronisation du projet vers le dossier de build ───────
echo [2/6] Synchronisation du code vers "%BUILD_DIR%"...
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
robocopy "%~dp0." "%BUILD_DIR%" /MIR /XD node_modules android dist dist_electron .expo .git .metro-health-check* /NFL /NDL /NJH /NJS /NP >nul
if %errorlevel% GEQ 8 (
    echo [ERREUR] Echec de la synchronisation robocopy.
    exit /b 1
)

REM ── 3. Dépendances dans le dossier de build ─────────────────────
pushd "%BUILD_DIR%"
if exist "node_modules\.pnpm" goto :deps_ok
echo [3/6] Installation des dépendances (réutilise le cache pnpm, rapide)...
call pnpm install --frozen-lockfile
if not %errorlevel%==0 popd & exit /b 1
:deps_ok
echo [3/6] Dépendances présentes.

REM ── 4. Garde-fous ──
echo [4/6] Vérifications (Supabase, types)...
node scripts\check-supabase-env.mjs --live
if not %errorlevel%==0 popd & exit /b 1
npx tsc --noEmit
if not %errorlevel%==0 popd & exit /b 1

REM ── 5. Projet natif + compilation ──
if exist "android\gradlew.bat" goto :native_ok
echo [5/6] Génération du projet natif Android (expo prebuild)...
call npx expo prebuild --platform android --no-install
if not %errorlevel%==0 popd & exit /b 1
:native_ok
echo [5/6] Compilation Gradle (le premier build peut durer 20-30 min)...
pushd android
call gradlew.bat assembleRelease --no-daemon
set "GRADLE_EXIT=%errorlevel%"
popd
popd
if not "%GRADLE_EXIT%"=="0" exit /b 1

REM ── 6. Copie du résultat ──
set "OUT_DIR=%~dp0..\..\fichiers-installation"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
copy /y "%BUILD_DIR%\android\app\build\outputs\apk\release\app-release.apk" "%OUT_DIR%\123Cuisine-android.apk" >nul
echo [6/6] APK copié dans "%OUT_DIR%".

echo.
echo ✅ TERMINÉ — APK : fichiers-installation\123Cuisine-android.apk
echo    Transférez-le sur le téléphone et ouvrez-le pour l'installer
echo    (autoriser « installer des applications inconnues » si demandé).
endlocal
