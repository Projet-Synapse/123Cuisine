#!/usr/bin/env bash
#############################################################################
#                      🔏 check-android-keystore.sh                         #
#############################################################################
#
# SOMMAIRE
#   1. Pourquoi ce fichier existe
#   2. Entrées et sorties
#   3. Les contrôles
#
# ── 1. Pourquoi ce fichier existe ────────────────────────────────────────
#
# Un secret GitHub ne se relit pas : une fois enregistré, personne — pas même
# la personne qui l'a posé — ne peut vérifier ce qu'il contient. Une faute de
# copier-coller ne se voit donc nulle part, et se manifestait autrefois au
# bout d'une demi-heure de compilation Gradle, sous la forme d'une erreur
# incompréhensible.
#
# Ce script éprouve les secrets en trois secondes et nomme le fautif. Il est
# appelé à deux endroits : par le job `android-build` de release.yml, juste
# avant de compiler, et par android-secrets.yml, qui ne fait que ça — de quoi
# éprouver un secret fraîchement collé sans lancer une release entière.
#
# ── 2. Entrées et sorties ────────────────────────────────────────────────
#
# Lit quatre variables d'environnement, dont deux seulement sont
# indispensables :
#   ANDROID_KEYSTORE_BASE64    le fichier .jks encodé          (obligatoire)
#   ANDROID_KEYSTORE_PASSWORD  mot de passe du magasin         (obligatoire)
#   ANDROID_KEY_ALIAS          alias de la clé                 (facultatif)
#   ANDROID_KEY_PASSWORD       mot de passe de la clé          (facultatif)
#
# Écrit le keystore décodé dans $RUNNER_TEMP (ou /tmp hors CI) et, si
# $GITHUB_ENV existe, y dépose les valeurs assainies pour les étapes
# suivantes du job.
#
# ── 3. Les contrôles ─────────────────────────────────────────────────────

set -e

RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"

KS="$RUNNER_TEMP/release.jks"
ERR="$RUNNER_TEMP/keytool.err"

# Un secret collé depuis un terminal traîne presque toujours une
# espace ou un retour à la ligne invisible — et l'interface GitHub ne
# permet pas de relire un secret pour s'en apercevoir. On élague donc
# les extrémités, mais seulement APRÈS avoir essayé la valeur telle
# quelle : un mot de passe a le droit de commencer par une espace.
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

if [ -z "$(trim "$ANDROID_KEYSTORE_BASE64")" ]; then
  echo "::error::Secret ANDROID_KEYSTORE_BASE64 absent — impossible de signer l'APK. Marche à suivre : .github/ANDROID.md"
  exit 1
fi

# Ici on retire TOUS les blancs, pas seulement ceux des extrémités :
# `base64` sans `-w0` découpe sa sortie en lignes de 76 caractères.
if ! printf '%s' "$ANDROID_KEYSTORE_BASE64" | tr -d '[:space:]' | base64 -d > "$KS" 2>/dev/null || [ ! -s "$KS" ]; then
  echo "::error::ANDROID_KEYSTORE_BASE64 ne contient pas du base64 valide. Y coller la sortie de : base64 -w0 123cuisine-release.jks"
  exit 1
fi

# Le mot de passe du magasin, essayé brut puis élagué.
# `> "$ERR" 2>&1` et pas `2> "$ERR"` : keytool écrit ses erreurs sur
# la sortie STANDARD, pas sur la sortie d'erreur. Les envoyer vers
# /dev/null rendait le diagnostic ci-dessous toujours faux.
PW="$ANDROID_KEYSTORE_PASSWORD"
if ! keytool -list -keystore "$KS" -storepass "$PW" > "$ERR" 2>&1; then
  PW_TRIMMED="$(trim "$ANDROID_KEYSTORE_PASSWORD")"
  if [ "$PW_TRIMMED" != "$ANDROID_KEYSTORE_PASSWORD" ] && keytool -list -keystore "$KS" -storepass "$PW_TRIMMED" > /dev/null 2>&1; then
    # `add-mask` avant toute utilisation : la variante élaguée n'est
    # pas le secret enregistré, GitHub ne la masquerait pas d'office.
    echo "::add-mask::$PW_TRIMMED"
    echo "::warning::Le secret ANDROID_KEYSTORE_PASSWORD contient une espace ou un retour à la ligne parasite ; il est élagué automatiquement, mais mieux vaut le recoller proprement."
    PW="$PW_TRIMMED"
  elif grep -qi 'password was incorrect\|tampered with' "$ERR"; then
    echo "::error::Le fichier est bien un keystore, mais ANDROID_KEYSTORE_PASSWORD ne l'ouvre pas. C'est CE secret-là qu'il faut corriger — le base64 est bon."
    exit 1
  else
    echo "::error::Le contenu de ANDROID_KEYSTORE_BASE64 n'est pas un keystore. Ce n'est pas un problème de mot de passe : c'est le fichier encodé qui n'est pas le bon."
    sed -n '1,3p' "$ERR"
    exit 1
  fi
fi

# L'alias : celui du secret s'il désigne vraiment une clé, sinon
# celui que porte le keystore. Il n'y a qu'une clé là-dedans, et
# cette information est DANS le fichier : en dépendre plutôt que
# d'un copier-coller supprime purement et simplement une cause de
# panne, sans rien deviner.
ALIAS="$(trim "$ANDROID_KEY_ALIAS")"
if [ -z "$ALIAS" ] || ! keytool -list -keystore "$KS" -storepass "$PW" -alias "$ALIAS" > /dev/null 2>&1; then
  DETECTED="$(keytool -list -keystore "$KS" -storepass "$PW" 2>/dev/null | awk -F', ' '/PrivateKeyEntry/ { print $1; exit }')"
  if [ -z "$DETECTED" ]; then
    echo "::error::Le keystore s'ouvre mais ne contient aucune clé privée — impossible de signer quoi que ce soit avec."
    exit 1
  fi
  if [ -n "$ALIAS" ]; then
    echo "::warning::Le secret ANDROID_KEY_ALIAS ne désigne aucune clé de ce keystore ; l'alias réellement présent est utilisé à sa place. Le build continue, mais ce secret mérite d'être corrigé (ou supprimé, il est facultatif)."
  fi
  ALIAS="$DETECTED"
fi
echo "::add-mask::$ALIAS"

# Le mot de passe de la clé. Le keystore est au format PKCS12, où il
# est forcément identique à celui du magasin : le secret est donc
# facultatif, et une valeur différente ne peut être qu'une erreur —
# Gradle échouerait dessus bien plus tard, sans rien dire d'utile.
KEY_PW="$(trim "$ANDROID_KEY_PASSWORD")"
if [ -z "$KEY_PW" ]; then
  KEY_PW="$PW"
elif [ "$KEY_PW" != "$PW" ]; then
  echo "::error::ANDROID_KEY_PASSWORD diffère de ANDROID_KEYSTORE_PASSWORD. Le keystore est au format PKCS12 : les deux doivent être identiques (ou ANDROID_KEY_PASSWORD supprimé, il est facultatif)."
  exit 1
fi
echo "::add-mask::$KEY_PW"

# Empreinte du certificat : à comparer avec celle du keystore local
# (keytool -list -v). Elle n'a rien de secret, elle voyage dans
# chaque APK — c'est justement ce qui permet de confirmer que la CI
# signe bien avec LA bonne clé.
echo "Keystore accepté. Empreinte du certificat :"
keytool -list -keystore "$KS" -storepass "$PW" -alias "$ALIAS" -v | grep -i 'SHA256:' || true

# Les valeurs assainies prennent le relais des secrets bruts pour toute la
# suite du job (prebuild et Gradle). Les étapes suivantes ne doivent donc PAS
# redéclarer ces variables dans leur bloc `env:`, sinon les valeurs non
# élaguées reviendraient par la fenêtre.
#
# Hors CI ($GITHUB_ENV n'existe pas), il n'y a rien à transmettre : le script
# se contente alors d'avoir dit si les secrets tiennent la route.
if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "ANDROID_KEYSTORE_PATH=$KS"
    echo "ANDROID_KEYSTORE_PASSWORD=$PW"
    echo "ANDROID_KEY_ALIAS=$ALIAS"
    echo "ANDROID_KEY_PASSWORD=$KEY_PW"
  } >> "$GITHUB_ENV"
fi
