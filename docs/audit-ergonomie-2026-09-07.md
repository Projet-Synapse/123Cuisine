//////////////////////////////////////////////////////////////////////////
//              🔎 Audit ergonomie & productivité — 07/09/2026            //
//////////////////////////////////////////////////////////////////////////

// SOMMAIRE
// 1. 🗒️ Résumé
// 2. 👍 Ce qui fonctionne déjà bien
// 3. 🛠️ Corrections appliquées dans cette routine
// 4. 📋 Pistes restantes — triées par impact / effort
//    4.1 🍽️ Recettes & mode cuisine
//    4.2 🛒 Courses
//    4.3 🗂️ Catégories & dossiers
//    4.4 🔐 Compte, réglages & connexion
//    4.5 🖥️ Ergonomie transverse
// 5. 🗺️ Priorisation recommandée

/*
 * Cet audit répond à la tâche planifiée du 07/09/2026 : « analyser le code
 * source et l'interface de 123Cuisine pour identifier des pistes
 * d'amélioration de la productivité et de l'ergonomie ». Il complète les
 * deux audits précédents (`audit-ergonomie-2026-08.md`,
 * `audit-ux-2026-08-30.md`) : plutôt que répéter leurs constats encore
 * valables, ce document vérifie ce qui a déjà été corrigé, applique les
 * correctifs à faible risque et fort impact qui restaient ouverts, et
 * liste ce qu'il reste à traiter.
 */

## 1. 🗒️ Résumé

Sur les ~25 pistes des deux audits précédents, une bonne partie reste
d'actualité (voir §4, reporté tel quel avec mise à jour de ce qui a changé).
Cette routine a corrigé sur place les points **impact fort / effort
faible** qui ne demandaient pas d'arbitrage produit ni de gros
remaniement visuel — cf. §3 — et vérifié via `tsc`, `eslint` et
`prettier --check` qu'aucune régression n'était introduite.

Un point positif à noter : `CookMode.tsx` a déjà `useKeepAwake()` en place
depuis le dernier audit — l'écran ne se verrouille plus pendant une étape
longue, contrairement à ce qui avait été relevé le 30/08.

## 2. 👍 Ce qui fonctionne déjà bien

Toujours valable (voir les audits précédents pour le détail) : mode
cuisine avec minuteur d'écran maintenu allumé, tri/recherche/filtres sur
les recettes, ajout rapide au clavier, tout-cocher sur les listes de
courses, recherche de vrais produits (Open Food Facts), tooltips
accessibles sur toutes les icônes, ajustement des portions, thème très
personnalisable, réordonnancement des recettes dans une catégorie,
détection automatique du rayon (`detectCategory`) désormais appliquée à
la création de recette comme à l'ajout d'un article de liste.

## 3. 🛠️ Corrections appliquées dans cette routine

**🐛 Bug fonctionnel corrigé — les portions ajustées n'atteignaient pas la
liste de courses.** `app/(recettes)/recipe/[id].tsx` : le bouton « Ajouter
à une liste » transmettait la recette d'origine (`recipe`) à
`addRecipeToList`, pas les ingrédients recalculés (`scaledIngredients`)
affichés à l'écran après un changement de portions. Un utilisateur qui
double une recette pour 8 personnes avant de l'ajouter aux courses se
retrouvait avec les quantités pour 4 personnes, sans avertissement —
exactement le genre d'erreur que l'app doit éviter (cf. l'intention du
projet dans CLAUDE.md : éviter les achats mal calculés). Corrigé en
transmettant `{ ...recipe, ingredients: scaledIngredients }`.

**✏️ Libellés « categorie » non accordés, restants du renommage
catalogues→catégories** (relevé le 30/08, pas encore traité) :
- `edit-categorie/[id].tsx` → « Modifier le categorie » → « Modifier la
  catégorie »
- `categorie/[id].tsx` → « Ajouter au categorie » → « Ajouter à la
  catégorie »
- `profile/[id].tsx` → « Ajouter à un categorie » → « Ajouter à une
  catégorie »
- `categories.tsx` → « Aucun categorie » → « Aucune catégorie », et fil
  d'Ariane racine « Catégorie » (singulier, incohérent avec l'onglet) →
  « Catégories »

**🧭 Repli de navigation manquant sur l'écran Notifications.**
`app/(parametres)/notifications.tsx` réimplémentait son propre bouton
retour avec un simple `router.back()`, sans le repli vers `/compte` que
les autres écrans de réglages ont via `SettingsPage`
(`components/settings/SettingsKit.tsx`). Un lien direct vers cet écran
(ex. depuis un e-mail de notification) sans pile de navigation aurait
laissé le bouton retour sans effet. Corrigé avec le même repli
(`router.canGoBack() ? router.back() : router.replace('/compte')`), sans
migrer tout l'écran vers `SettingsKit` pour rester à risque visuel nul.

**👆 Points de progression du mode cuisine rendus tapables.**
`components/CookMode.tsx` : revenir de l'étape 8 à l'étape 2 demandait 6
taps sur « Précédent », les points de progression n'étant que visuels. Ils
sont maintenant chacun dans un `Pressable` (`onPress={() =>
setStepIndex(i)}`) avec libellé d'accessibilité, sans changer l'apparence
de la barre de progression.

**🔘 Double zone cliquable sur les cases « allergie ».**
`app/(parametres)/gouts.tsx` : toute la ligne et le `Switch` interne
déclenchaient tous deux `toggleInList`, avec un risque de
double-déclenchement selon la plateforme. Ajout de `pointerEvents="none"`
sur le `Switch` puisque toute la ligne est déjà cliquable — le `Switch`
reste purement visuel (son état suit déjà `active`).

Toutes ces corrections ont été vérifiées avec `npx tsc --noEmit`, `npx
eslint` sur les fichiers modifiés et `npx prettier --check` (0 erreur), en
plus d'une relecture manuelle de chaque site d'appel.

## 4. 📋 Pistes restantes — triées par impact / effort

Le détail complet (fichier:ligne, justification) reste dans
`audit-ux-2026-08-30.md` §4 et `audit-ergonomie-2026-08.md` §4/§5 ; en
résumé, restent ouvertes :

**Gains rapides à fort impact, effort faible :**
- Recherche dans les réglages de « Mon espace » (`compte.tsx`)
- Sélecteur d'unité avec recherche (création/édition de recette)
- Filtre par tag dans la recherche de recettes
- Sélecteur de rayon explicite à l'ajout d'un ingrédient (au lieu d'une
  détection silencieuse)

**Impact fort, effort moyen :**
- Autocomplétion des ingrédients à la création de recette (réutiliser la
  recherche Open Food Facts déjà utilisée côté courses)
- Confirmation avant perte d'un formulaire non enregistré (recettes et
  catégories)
- Partage natif d'une recette / liste de courses (`Share.share()`)
- Biométrie + refonte de l'inscription en étapes
- Mode invité mis en avant dès l'écran de connexion
- Réordonnancement manuel des catégories/dossiers de premier niveau
  (mécanisme déjà écrit pour les recettes d'une catégorie)
- Actions groupées (bulk) sur les catégories
- Import/collage en masse d'ingrédients à la création de recette
- Fusion des quantités (au lieu du filtrage silencieux) quand deux
  recettes ajoutées à une même liste partagent un ingrédient

**Notés pour plus tard (impact réel, effort plus important) :** scan
code-barres, dictée vocale, indicateur de connectivité/synchronisation,
raccourcis clavier desktop (Electron), swipe-to-delete, glisser-déposer
catégorie → dossier, recherche transverse dans les dossiers imbriqués,
recherche unifiée (recettes + articles + personnes), historique de
cuisine, rappel de liste « en cours » via l'infrastructure de
notifications existante.

## 5. 🗺️ Priorisation recommandée

1. ✅ Fait dans cette routine : bug des portions, libellés « categorie »,
   repli de navigation Notifications, points de progression tapables,
   double zone cliquable des allergies.
2. Prochain lot à faible effort : recherche dans les réglages, sélecteur
   d'unité avec recherche, filtre par tag, sélecteur de rayon explicite.
3. Ensuite, par ordre d'impact perçu : autocomplétion d'ingrédients,
   confirmation de perte de formulaire, partage natif, réordonnancement
   des catégories, actions groupées.
4. Le reste (scan code-barres, dictée vocale, raccourcis desktop...) à
   ne pas lancer avant d'avoir traité ce qui précède.

---
_Généré automatiquement par une routine d'analyse planifiée._
