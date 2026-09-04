//////////////////////////////////////////////////////////////////////////
//              🔎 Audit ergonomie & productivité — Août 2026             //
//////////////////////////////////////////////////////////////////////////

// SOMMAIRE
// 1. 🗒️ Résumé
// 2. 👍 Ce qui fonctionne déjà bien
// 3. 🐛 Point de friction prioritaire (bug fonctionnel)
// 4. 📋 Suggestions priorisées (impact / effort)
// 5. 🔬 Détail des suggestions

## 1. 🗒️ Résumé

Analyse du code source et des parcours utilisateur de 123Cuisine (accueil,
recherche, courses, catégories, recette, mode cuisine) à la recherche de
frictions et de fonctionnalités manquantes qui limitent la productivité et
l'ergonomie. L'application est déjà mature sur ce plan (mode cuisine, tri,
ajout rapide au clavier, tout cocher, catalogue de courses, comparateur de
prix, dossiers imbriqués avec fil d'Ariane) — les commits récents montrent
que ces axes sont déjà activement travaillés.

Un vrai bug de friction a toutefois été identifié (voir §3) : il casse
silencieusement le rangement par rayon des listes de courses générées
depuis une recette. Le reste du document liste des améliorations
incrémentales, classées par impact et effort.

## 2. 👍 Ce qui fonctionne déjà bien

- **Accueil** : salutation contextuelle, carte "Liste en cours" avec barre
  de progression, recommandations "Pour vous" basées sur les préférences,
  actions rapides en un tap.
- **Recherche** : filtres (difficulté, favoris) + tri (pertinence, rapide,
  récent) combinables, onglet "Personnes" séparé avec anti-rebond sur la
  recherche.
- **Courses** : ajout d'article avec détection auto d'unité et de rayon,
  recherche de vrais produits (Open Food Facts) en tapant, catalogue
  parcourable, comparateur de prix par magasin et par article, tout
  cocher/décocher en un tap, impression formatée.
- **Recette** : mode cuisine dédié, stepper de portions qui recalcule les
  quantités à la volée, impression, bascule public/privé.
- **Catégories** : dossiers imbriqués avec fil d'Ariane, une catégorie peut
  appartenir à plusieurs dossiers, aperçu des recettes en un coup d'œil.
- Les micro-textes de commentaires dans le code (`recipes.tsx`,
  `categories.tsx`) montrent qu'un vrai travail d'ergonomie itératif est
  déjà en cours (bulles d'aide sur les icônes seules, résolution de bugs de
  photo silencieux, etc.).

## 3. 🐛 Point de friction prioritaire (bug fonctionnel)

**Tous les ingrédients ajoutés à une recette sont classés "Légumes",
quel que soit leur vrai rayon.**

- `app/(recettes)/create-recipe.tsx:108` et
  `app/(recettes)/edit-recipe/[id].tsx:124` codent en dur
  `category: 'Légumes'` pour chaque ingrédient ajouté — aucun sélecteur de
  rayon n'est proposé à l'écriture.
- Quand la recette est ensuite envoyée vers une liste de courses
  (`contexts/KitchenContext.tsx:360`, `addRecipeToList`), c'est cette
  catégorie figée qui est recopiée telle quelle sur l'article de la liste.
- Résultat concret : dans `app/(courses)/list/[id].tsx`, le regroupement
  par rayon (`grouped`, l. 167-177) et l'estimation de prix par catégorie
  entassent farine, lait, poulet, épices... sous "Légumes", alors que
  l'écran de courses détecte pourtant très bien la vraie catégorie quand
  on tape un article à la main (`detectCategory`, utilisé en
  `list/[id].tsx:197` mais jamais dans les deux écrans de recette).

**Impact** : c'est justement l'un des usages phares de l'app — cuisiner
une recette puis générer sa liste de courses rangée par rayon pour aller
plus vite en magasin — qui perd sa valeur dès que la recette a plus d'un
ingrédient qui n'est pas un légume.

**Correctif suggéré** (effort faible) : appeler `detectCategory(name)`
(déjà utilisé dans `priceService`/`list/[id].tsx`) au moment d'ajouter un
ingrédient dans `create-recipe.tsx` et `edit-recipe/[id].tsx`, à la place
de la valeur figée `'Légumes'` — cohérent avec ce qui existe déjà pour les
articles de courses.

## 4. 📋 Suggestions priorisées (impact / effort)

| # | Suggestion | Impact | Effort | Priorité |
|---|---|---|---|---|
| 1 | Corriger la catégorie figée "Légumes" des ingrédients (§3) | Élevé | Faible | 🔴 Immédiat |
| 2 | Sélecteur de rayon explicite à l'ajout d'un ingrédient (au lieu d'une détection silencieuse) | Moyen | Faible | 🟠 Court terme |
| 3 | Bouton "Ajouter les ingrédients manquants à ma liste" directement en mode cuisine | Moyen | Faible | 🟠 Court terme |
| 4 | Import/collage en masse d'ingrédients (une ligne = un ingrédient, parsé automatiquement) | Élevé | Moyen | 🟠 Court terme |
| 5 | Fusion automatique des doublons quand plusieurs recettes sont ajoutées à la même liste (ex. "farine" x2 → 1 ligne cumulée) | Moyen | Moyen | 🟡 Moyen terme |
| 6 | Rappel/notification quand une liste de courses reste "en cours" plusieurs jours sans être complétée | Faible-Moyen | Faible | 🟡 Moyen terme |
| 7 | Recherche globale unique (recettes + articles + personnes) au lieu de trois recherches séparées | Moyen | Moyen | 🟡 Moyen terme |
| 8 | Historique / recettes "cuisinées récemment" pour resservir vite un plat déjà fait | Faible-Moyen | Faible | 🟢 Bonus |

## 5. 🔬 Détail des suggestions

**#2 — Sélecteur de rayon explicite.** La détection auto (`detectUnit`,
`detectCategory`) est une bonne base, mais reste invisible tant qu'on n'a
pas ouvert le détail d'un article existant : un utilisateur ajoutant "spéculoos"
ne saura pas dans quel rayon il vient d'atterrir avant de retourner voir la
liste groupée. Afficher la catégorie détectée à côté de l'unité détectée
(déjà fait pour l'unité dans `list/[id].tsx` avec `detectedUnit`) et
permettre de la corriger d'un tap fermerait la boucle.

**#3 — Ajout depuis le mode cuisine.** `CookMode.tsx` affiche les
ingrédients pendant qu'on cuisine, mais pour ajouter ce qui manque à la
liste de courses il faut quitter le mode cuisine, revenir sur la fiche
recette, puis "Ajouter à une liste". Un utilisateur qui découvre en
cuisinant qu'il lui manque un ingrédient doit interrompre son geste. Un
raccourci directement dans `CookMode` réduirait la friction à l'usage réel
(en cuisine, mains occupées).

**#4 — Collage en masse.** La création de recette ajoute les ingrédients un
par un (`addIngredient`, `create-recipe.tsx:104`). Pour quelqu'un qui
recopie une recette trouvée ailleurs (livre, site, photo), retaper chaque
ligne dans trois champs séparés (nom / quantité / unité) est le principal
point de friction à la création. Un champ "coller la liste" qui découpe
par ligne et pré-remplit nom/quantité/unité (avec possibilité de corriger
ensuite) accélérerait beaucoup la saisie — dans l'esprit de ce que fait déjà
`detectUnit`/`detectCategory` côté courses.

**#5 — Fusion des doublons.** `addRecipeToList` (`KitchenContext.tsx:354`)
ignore déjà les ingrédients dont le nom existe mot pour mot dans la liste
(`existingNames`), mais n'additionne pas les quantités : ajouter deux
recettes qui utilisent toutes deux "oignon" ne fusionne pas les quantités,
la seconde est simplement filtrée en silence — l'utilisateur perd la
quantité de la deuxième recette sans le savoir.

**#6 — Rappel de liste en cours.** L'app a déjà une infrastructure de
notifications programmées (`services/parametres/notificationService.ts`,
`supabase/functions/send-notification-digests`) ; une liste de courses
non complétée après N jours est un signal naturel à ajouter à ce système
existant plutôt qu'à construire de zéro.

**#7 — Recherche unifiée.** L'écran `recipes.tsx` sépare déjà "Mes
recettes" / "Communauté" / "Personnes" avec une seule barre de recherche
par onglet — cohérent, mais oblige à changer d'onglet pour savoir si un
terme correspond à une personne ou une recette. Un mode "tout" en haut des
résultats (quelques puces de résultats croisés) éviterait l'aller-retour.

**#8 — Historique de cuisine.** Aucune trace n'est gardée du fait qu'une
recette a été cuisinée (seulement favoris/récent-créé). Un compteur "vu en
mode cuisine le [date]" donnerait un signal simple pour retrouver vite ce
qu'on refait souvent, sans effort de saisie supplémentaire côté
utilisateur.

---
_Généré automatiquement par une routine d'analyse planifiée._
