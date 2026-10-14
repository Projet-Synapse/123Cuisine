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

### 🔰 Sécurité
- [ ] `searchUsers` permet de trouver n'importe quel inscrit par son e-mail — envisager de limiter la recherche au pseudo (+1)

### 🗂 Organisation
- [ ] KitchenContext refait les appels SQL déjà présents dans kitchenService (deux couches redondantes) — unifier (+1)

### 🚀 Performance
- [ ] Les policies RLS des menus contiennent des sous-requêtes évaluées par ligne — surveiller/optimiser si `weekly_menu_members` grossit (+1)

## Historique
- 2026-10-14 : création à l'occasion de la fonctionnalité « Menu de la semaine », premier bilan.
