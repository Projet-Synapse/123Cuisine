# Scores de qualité — 123Cuisine

| Dimension | Score |
|---|---|
| ♻ Ergonomie | 8/10 |
| 👍 Stabilité | 6/10 |
| 🔰 Sécurité | 8/10 |
| 🗂 Organisation | 7/10 |
| 🚀 Performance | 7/10 |

Bilan initial posé le 2026-10-14 pendant l'ajout du « Menu de la semaine », d'après ce qui a été réellement observé du code : conventions UI solides et homogènes (états vides, chargement, tooltips, labels d'accessibilité), RLS et grants systématiques côté SQL, écritures optimistes avec alerte d'échec — mais zéro test automatisé et une redondance service/contexte assumée.

## Tâches

### ♻ Ergonomie
- [ ] Tester le board du menu à 7 colonnes dans une fenêtre étroite (tablette) et ajuster les largeurs si les cartes sont illisibles (+1)
- [ ] Web : le bouton « Continuer sans compte » de l'écran de connexion ramène à /login (la route / est gardée par AuthRouter, cf. app/index.tsx) — l'accès invité ne passe que par URL directe ; constaté le 2026-10-14 pendant le test du menu (+1)

### 👍 Stabilité
- [ ] Mettre en place un framework de tests (jest-expo) et couvrir `weeklyMenuService` (semaines, déplacements de plats) (+1)
- [ ] Vérifier les policies RLS de 0007 par des tests SQL une fois la migration appliquée en ligne (membre lit/modifie, non-membre ne voit rien) (+1)
- [ ] CI : réparer le build APK sur GitHub — `build-android-apk.yml` impose `version: 10` à pnpm/action-setup (conflit avec packageManager, KO sur chaque tag depuis v1.3.0 ; correctif prêt sur la branche locale `ci-pnpm-fix`) ET `release.yml`/`android-build` : `android-actions/setup-android@v3` casse sur le paquet `tools` supprimé par Google (passer à @v4 ou supprimer l'étape, le SDK est préinstallé sur les runners). Les deux demandent le scope `workflow` que le jeton actuel n'a pas (2026-10-14 : APK v1.4.0 construit en local via C:\b\123Cuisine + toolchain `~/android-build`) (+1)

### 🔰 Sécurité
- [ ] `searchUsers` permet de trouver n'importe quel inscrit par son e-mail — envisager de limiter la recherche au pseudo (+1)

### 🗂 Organisation
- [ ] KitchenContext refait les appels SQL déjà présents dans kitchenService (deux couches redondantes) — unifier (+1)

### 🚀 Performance
- [ ] Les policies RLS des menus contiennent des sous-requêtes évaluées par ligne — surveiller/optimiser si `weekly_menu_members` grossit (+1)

## Historique
- 2026-10-14 : création à l'occasion de la fonctionnalité « Menu de la semaine », premier bilan.
