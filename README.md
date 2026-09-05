# 🍳 123Cuisine

Vos recettes, vos courses, votre cuisine — sur **tous vos appareils**.

123Cuisine est une application de cuisine multiplateforme (Android, iOS,
Windows, macOS, Linux, web) construite avec **Expo / React Native** et
**Supabase**. Elle sert à s'organiser autour de l'alimentation : recettes,
listes de courses, organisation par catégories, avec un mode sans compte
pour commencer sans friction.

➡️ **Pour installer l'application sur chaque plateforme, lire
[INSTALLATION.md](./INSTALLATION.md).**

---

## ✨ Ce que fait l'application

Cinq onglets principaux :

| Onglet | Contenu |
|---|---|
| **Accueil** | Vue d'ensemble : recettes favorites, raccourci vers la liste de courses en cours, suggestions |
| **Rechercher** | Toutes les recettes (les vôtres + les recettes publiques de la communauté), filtres par tags/régime |
| **Courses** | Listes de courses par magasin (Leclerc, Intermarché, Carrefour…), recherche de produits via **Open Food Facts**, prix, coche des articles |
| **Catégories** | Classement des recettes en catégories et **dossiers** imbriqués (arborescence) |
| **Mon espace** | Profil, préférences de goûts (ingrédients aimés/détestés, allergies, régimes), apparence, données, sécurité |

Autres fonctions notables :
- **Mode cuisine** (écran plein, étapes une par une) et impression de la
  fiche recette (aperçu dédié sur la version bureau) ;
- **Mode invité** : tout est utilisable sans compte (données en local), puis
  **migration proposée automatiquement** vers le compte à la connexion ;
- **Connexion par pseudo** (pas d'e-mail côté utilisateur) via une fonction
  Edge Supabase ;
- Thème clair/sombre, personnalisable (Réglages → Apparence) ;
- Mise à jour automatique de la version bureau (electron-updater).

## 🏗️ Architecture

- **Expo SDK 53 / React Native 0.79 / React 19**, expo-router (navigation par
  fichiers), TypeScript strict ;
- **Web** : export statique (`expo export`), installable en PWA
  (`public/manifest.json`) ;
- **Bureau** : Electron charge le site exporté via un petit serveur HTTP local
  (`electron/main.js`) avec CSP stricte, aperçu d'impression et
  auto-mise à jour ; empaqueté par electron-builder (NSIS / DMG / AppImage) ;
- **Données** : Supabase (PostgreSQL + Storage + Edge Functions, migrations
  SQL dans `supabase/migrations/`) ; stockage local (AsyncStorage) en mode
  invité ;
- **CI** : GitHub Actions — release desktop multi-OS + APK (`release.yml`),
  APK sans compte Expo (`build-android-apk.yml`), déploiement web
  (`deploy-web.yml`).

```
app/            écrans (expo-router) : (tabs), (recettes), (courses), (categories), (parametres)
components/     composants partagés (CookMode, ErrorBoundary, UpdateBanner…)
contexts/       état global (KitchenContext : recettes/listes/catégories, ThemeContext)
services/       couche données (Supabase + local) : kitchenService, auth, cours, social
template/       gabarit d'authentification Supabase/mock + client Supabase
supabase/       migrations SQL et fonctions Edge (username-auth, recommandations, digests)
electron/       process principal + preload de la version bureau
```

## 🧪 Qualité

```bash
pnpm run verify    # config Supabase (--live dispo) + types TypeScript + ESLint
```

Un garde-fou (`scripts/check-supabase-env.mjs`) refuse toute construction si
`.env` ne pointe pas sur le projet Supabase attendu — né d'une vraie panne de
production (v1.2.4 partie avec un backend mort).
