#!/bin/bash
#############################################################################
#                   🛡️ build-apk-resilient.sh                              #
#############################################################################
#
# Construction locale de l'APK Android avec garde-fous, née des pannes réelles
# de la release v1.4.0 (2026-10-14) — chaque garde correspond à un incident
# vécu, pas à une crainte hypothétique :
#
#   1. Chemin du projet avec espaces/émojis : la toolchain Android (CMake,
#      Ninja, hermesc) ne le supporte pas -> copie miroir dans un chemin sans
#      espaces (C:\b\<slug>), comme le fait déjà build-android-apk.bat.
#   2. Réseau instable (bad_record_mac / connexions réinitialisées) : le
#      wrapper Gradle et Gradle lui-même échouent en plein téléchargement.
#      -> distribution Gradle réparée par reprises curl ; artefacts Maven en
#      échec téléchargés puis semés dans le cache avec VÉRIFICATION sha1
#      (un fichier corrompu qui passerait le contrôle de taille serait rejeté
#      en silence par Gradle, qui retéléchargerait en boucle).
#   3. Mise en veille du PC en plein build : l'état Ninja (.cxx) est tronqué
#      (« premature end of file ») -> veille désactivée pendant le build et
#      rétablie ensuite ; et si l'état Ninja est malgré tout corrompu,
#      suppression du .cxx de l'app seule (les modules natifs déjà compilés
#      sont conservés) puis nouvelle tentative.
#   4. local.properties en backslashes : le format properties traite « \ »
#      comme un échappement -> « C\:\Users... » donne un chemin invalide.
#      -> toujours des slashes : sdk.dir=C\:/Users/...
#   5. Espace disque : un build RN consomme plusieurs Go -> refus si moins de
#      15 Go libres.
#
# Usage : bash scripts/build-apk-resilient.sh
# Sortie : fichiers-installation/123Cuisine-android.apk (à côté du dépôt)
#############################################################################

set -u

# ── Réglages (surchargables par variables d'environnement) ──────────────
SRC_DIR="${SRC_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BUILD_DIR="${BUILD_DIR:-C:\\b\\123Cuisine}"           # chemin SANS espaces
JAVA_HOME="${JAVA_HOME:-C:\\Users\\catel\\android-build\\jdk-17.0.20.1+1}"
ANDROID_SDK="${ANDROID_SDK:-C:\\Users\\catel\\android-build\\android-sdk}"
OUT_FILE="${OUT_FILE:-$SRC_DIR/../fichiers-installation/123Cuisine-android.apk}"
MIN_FREE_GB="${MIN_FREE_GB:-15}"
GRADLE_VERSION="8.13"                                  # cf. gradle-wrapper.properties

BUILD_DIR_U="${BUILD_DIR//\\//}"
LOG=/tmp/gradle-build-resilient.log

die() { echo "❌ $*"; exit 1; }
step() { echo "▶ $*"; }

# ── 1. Prérequis ─────────────────────────────────────────────────────────
step "Vérification des outils"
[ -x "$JAVA_HOME/bin/java.exe" ] || die "JDK 17 introuvable dans $JAVA_HOME"
[ -d "$ANDROID_SDK/platforms" ] || die "SDK Android introuvable dans $ANDROID_SDK"
[ -d "$ANDROID_SDK/ndk" ] || die "NDK manquant dans $ANDROID_SDK/ndk"
command -v node >/dev/null || die "node introuvable dans le PATH"
command -v pnpm >/dev/null || die "pnpm introuvable dans le PATH"
FREE_KB=$(df -k /c | tail -1 | awk '{print $4}')
[ "$FREE_KB" -gt $((MIN_FREE_GB * 1024 * 1024)) ] || die "Moins de ${MIN_FREE_GB} Go libres sur C: ($((FREE_KB / 1024 / 1024)) Go) — libérez de l'espace, un build RN en consomme plusieurs."
echo "  OK (disque : $((FREE_KB / 1024 / 1024)) Go libres)"

# ── 2. Copie miroir vers un chemin sans espaces (tar = unicode-safe) ────
step "Copie du projet vers $BUILD_DIR_U"
mkdir -p "$BUILD_DIR_U"
cd "$SRC_DIR" || die "source inaccessible"
tar cf - \
  --exclude=./node_modules --exclude=./android --exclude=./android.bak \
  --exclude=./dist --exclude=./dist_electron --exclude=./.expo --exclude=./.git \
  . | (cd "$BUILD_DIR_U" && tar xf -) || die "échec de la copie"

# ── 3. Dépendances ───────────────────────────────────────────────────────
step "Dépendances (pnpm install --frozen-lockfile)"
cd "$BUILD_DIR_U" || exit 1
pnpm install --frozen-lockfile --prefer-offline || die "pnpm install"

# ── 4. Garde-fous du projet ──────────────────────────────────────────────
step "Garde-fous (config Supabase, types)"
node scripts/check-supabase-env.mjs || die "configuration Supabase invalide"
npx tsc --noEmit || die "erreurs TypeScript"

# ── 5. Projet natif + local.properties en SLASHES ────────────────────────
if [ ! -f android/gradlew.bat ]; then
  step "Génération du projet natif (expo prebuild)"
  npx expo prebuild --platform android --no-install || die "prebuild"
fi
printf 'sdk.dir=C\\:/%s\n' "$(echo "$ANDROID_SDK" | sed 's|^C:\\/||; s|\\|/|g')" > android/local.properties
grep -q "^sdk.dir=C\\\\:/\|sdk.dir=C:/\|sdk.dir=C\\\\:" android/local.properties || die "local.properties mal formé"

# ── 6. Distribution Gradle : réparer par reprises si le réseau casse ────
DIST_HASH_DIR=$(grep -oE "gradle-$GRADLE_VERSION-bin" android/gradle/wrapper/gradle-wrapper.properties >/dev/null \
  && ls "$HOME/.gradle/wrapper/dists/gradle-$GRADLE_VERSION-bin" 2>/dev/null | head -1)
DIST_DIR="$HOME/.gradle/wrapper/dists/gradle-$GRADLE_VERSION-bin/$DIST_HASH_DIR"
ZIP="$DIST_DIR/gradle-$GRADLE_VERSION-bin.zip"
URL="https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip"
if [ -n "$DIST_HASH_DIR" ] && [ ! -f "$DIST_DIR/gradle-$GRADLE_VERSION-bin.zip.ok" ]; then
  step "Distribution Gradle incomplète -> réparation par reprises"
  EXPECTED=$(curl -sIL "$URL" | grep -i '^content-length' | tail -1 | tr -d '\r' | awk '{print $2}')
  for i in $(seq 1 40); do
    curl -sL -C - --connect-timeout 20 -o "$ZIP" "$URL"
    SIZE=$(stat -c %s "$ZIP" 2>/dev/null || echo 0)
    [ "$SIZE" = "$EXPECTED" ] && [ "$SIZE" != "0" ] && break
    sleep 2
  done
  [ "$(stat -c %s "$ZIP" 2>/dev/null)" = "$EXPECTED" ] || die "téléchargement Gradle impossible après reprises"
  (cd "$DIST_DIR" && unzip -qo "$ZIP" && touch "gradle-$GRADLE_VERSION-bin.zip.ok" && rm -f *.lck *.part)
  echo "  OK"
fi

# ── 7. Anti-veille : pas de stand-by pendant le build ────────────────────
prev_ac=$(powercfg /q SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 2>/dev/null | grep -A 1 "Power Setting Index" | head -1 | grep -oE "0x[0-9a-f]+")
prev_dc=$(powercfg /q SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 2>/dev/null | grep -A 1 "Power Setting Index" | tail -1 | grep -oE "0x[0-9a-f]+")
powercfg /change standby-timeout-ac 0 >/dev/null 2>&1
powercfg /change standby-timeout-hibernate 0 >/dev/null 2>&1
restore_sleep() {
  [ -n "${prev_ac:-}" ] && powercfg /change standby-timeout-ac "$((prev_ac))" >/dev/null 2>&1
  [ -n "${prev_dc:-}" ] && powercfg /change standby-timeout-dc "$((prev_dc))" >/dev/null 2>&1
}
trap restore_sleep EXIT

# ── 8. Boucle de build : semis d'artefacts + réparation Ninja ────────────
CACHE=/c/Users/catel/.gradle/caches/modules-2/files-2.1
cd android || exit 1

seed_url() {
  # Télécharge un artefact Maven en reprises, VÉRIFIE son sha1 contre le
  # <url>.sha1 du dépôt, puis le dépose au format du cache Gradle.
  local url="$1" path f rest v a g expected_sha sha size dir tmp
  path="${url#*maven2/}"
  f="${path##*/}"; rest="${path%/*}"
  v="${rest##*/}"; rest="${rest%/*}"
  a="${rest##*/}"; g="${rest%/*}"; g="${g//\//.}"
  expected_sha=$(curl -sL --connect-timeout 20 "$url.sha1" | head -c 40)
  tmp="/tmp/seed-$f"; rm -f "$tmp"
  for i in $(seq 1 30); do
    curl -sL -C - --connect-timeout 20 -o "$tmp" "$url"
    size=$(stat -c %s "$tmp" 2>/dev/null || echo 0)
    sha=$(sha1sum "$tmp" 2>/dev/null | cut -d' ' -f1)
    if [ "${#expected_sha}" = 40 ]; then
      [ "$sha" = "$expected_sha" ] && break
      rm -f "$tmp"   # flux corrompu : la reprise n'a pas de sens, on repart de zéro
    else
      [ "$size" != "0" ] && break
    fi
    sleep 2
  done
  [ "${#expected_sha}" = 40 ] && [ "$sha" != "$expected_sha" ] && { echo "  [seed] échec sha1 : $f"; return 1; }
  dir="$CACHE/${g//./\/}/$a/$v/$sha"
  mkdir -p "$dir" && cp "$tmp" "$dir/$f" && rm -f "$tmp"
  echo "  [seed] $f déposé (sha1 vérifié)"
}

for tent in $(seq 1 10); do
  step "Compilation Gradle (tentative $tent)"
  cmd //c "gradlew.bat assembleRelease --no-daemon" > "$LOG" 2>&1
  if grep -q "BUILD SUCCESSFUL" "$LOG"; then
    echo "✅ BUILD SUCCESSFUL"
    break
  fi
  # a) artefacts Maven victimes du réseau -> semis vérifié puis retry
  grep -a -oE "Could not get resource 'https://[^']+'" "$LOG" \
    | sed "s/Could not get resource '//;s/'//" | sort -u > /tmp/failed-urls.txt
  if [ -s /tmp/failed-urls.txt ]; then
    echo "  Artefacts à re-télécharger : $(wc -l < /tmp/failed-urls.txt)"
    while read -r u; do seed_url "$u"; done < /tmp/failed-urls.txt
    continue
  fi
  # b) état Ninja corrompu (veille/mort du process) -> .cxx de l'APP seulement
  if grep -aq "premature end of file" "$LOG"; then
    echo "  État Ninja corrompu -> nettoyage de app/.cxx (modules conservés)"
    rm -rf app/.cxx
    continue
  fi
  # c) erreur ni réseau ni Ninja : on l'affiche et on s'arrête
  tr -d '\0' < "$LOG" | grep -a -A 10 "What went wrong" | head -14
  die "erreur de compilation non résolue par les garde-fous (voir $LOG)"
done

grep -q "BUILD SUCCESSFUL" "$LOG" || die "build non abouti après les tentatives"

# ── 9. Récupération de l'APK ─────────────────────────────────────────────
APK="app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || die "APK introuvable après un build « réussi » ?!"
SIZE_MB=$(( $(stat -c %s "$APK") / 1024 / 1024 ))
[ "$SIZE_MB" -ge 20 ] || die "APK de ${SIZE_MB} Mo seulement — sortie suspecte, ne pas distribuer"
mkdir -p "$(dirname "$OUT_FILE")"
cp "$APK" "$OUT_FILE"
echo "✅ APK : $OUT_FILE (${SIZE_MB} Mo)"
