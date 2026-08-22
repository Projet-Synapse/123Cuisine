#!/usr/bin/env bash
# Garde-fou de fin de tâche (hook Stop, cf. .claude/settings.json).
# Même ordre que le job `verify` de .github/workflows/release.yml : la
# configuration d'abord, parce que c'est la seule panne que ni tsc ni eslint
# ne voient (cf. 1.2.4, publiée avec un backend mort).
cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! OUT=$(node scripts/check-supabase-env.mjs 2>&1); then
  echo "❌ Configuration Supabase invalide — l'appli se construirait sans erreur mais sans connexion :" >&2
  echo "$OUT" >&2
  exit 2
fi

if ! OUT=$(npx tsc --noEmit 2>&1); then
  echo "❌ Erreurs TypeScript — corrige-les avant de conclure :" >&2
  echo "$OUT" >&2
  exit 2
fi

if ! OUT=$(npm run lint 2>&1); then
  echo "❌ Erreurs ESLint — corrige-les avant de conclure :" >&2
  echo "$OUT" >&2
  exit 2
fi

exit 0
