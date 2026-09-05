# 📦 INSTALLATION — 123Cuisine sur toutes les plateformes

123Cuisine est une application **Expo (React Native)** : un seul code source
pour toutes les plateformes. Ce document explique, pour chacune, **comment
installer l'application** (fichier prêt à l'emploi) et **comment la
construire** soi-même.

| Plateforme | Fichier à installer | Comment l'obtenir |
|---|---|---|
| 🪟 Windows | `123Cuisine-Setup-windows.exe` | Construit localement (voir plus bas) ou release GitHub |
| 🤖 Android | `123Cuisine-android.apk` | Construit localement, CI GitHub, ou EAS Build |
| 🍎 iOS | (App Store / TestFlight) | Nécessite un Mac ou EAS Build + compte Apple Developer |
| 🐧 Linux | `123Cuisine.AppImage` | Construit sur CI GitHub (`release.yml`) |
| 🍝 macOS | `123Cuisine.dmg` | Construit sur CI GitHub (`release.yml`) |
| 🌐 Web / PWA | Rien à installer — URL | Déployé sur GitHub Pages par `deploy-web.yml` |

---

## 1. 🪟 Windows

### Installer
1. Récupérer `123Cuisine-Setup-windows.exe` (dossier `fichiers-installation/`
   après un build local, ou onglet *Releases* du dépôt GitHub).
2. Double-cliquer : l'installation est silencieuse (une seule fenêtre,
   pas d'assistant) et l'application se lance toute seule.
3. L'app se met à jour **toute seule** par la suite (electron-updater,
   bouton *Réglages → Mises à jour* pour vérifier manuellement).

### Construire l'installeur soi-même
Prérequis : **Node.js 20+** (https://nodejs.org). Le script installe le reste.

```bat
build-windows.bat
```

Le résultat est copié dans `..\..\fichiers-installation\123Cuisine-Setup-windows.exe`.
Équivalent manuel : `pnpm install` puis `pnpm run dist:win`.

> ⚠️ Le bloc `files:` de `electron-builder.yml` est délicat (ordre des
> motifs `dist` / `!node_modules`) : après toute modification, vérifier que
> l'`app.asar` contient bien les polices — cf. commentaire dans le fichier,
> le contrôle doit renvoyer **23** fichiers `.ttf`.

---

## 2. 🤖 Android

### Installer (sideload, sans Play Store)
1. Récupérer `123Cuisine-android.apk`.
2. Le transférer sur le téléphone (câble, e-mail, Drive…) et l'ouvrir.
3. Accepter « Installer des applications inconnues » pour la source —
   c'est le passage obligé pour tout APK hors Play Store.
4. L'APK est signé avec la clé de débogage : il s'installe partout mais
   **ne peut pas** être publié tel quel sur le Play Store (voir plus bas).

### Trois façons de construire l'APK

**a. Sur ce PC (script fourni)** — prérequis une seule fois :
JDK 17 (Eclipse Temurin) + SDK Android (`platforms;android-35`,
`build-tools;35.0.0`, `ndk;27.1.12297006`, licences acceptées). Les chemins
par défaut du script correspondent à `C:\AI\creation logiciel\jdk17` et
`C:\Android\Sdk` (installés lors de la mise en place, modifiables en tête
de script).

```bat
build-android-apk.bat
```

Résultat : `..\..\fichiers-installation\123Cuisine-android.apk`.
Le premier build télécharge Gradle et prend 20 à 30 minutes ; les suivants
sont rapides.

> ⚠️ **Piège connu (contourné par le script)** : ce projet vit dans
> `C:\AI\creation logiciel\…` — l'**espace** du chemin casse la chaîne
> Android native sous Windows (hermesc appelé sans quotage par le plugin
> Gradle de RN, boucle CMake/Ninja de Reanimated). Le script construit donc
> depuis une copie du projet dans `C:\123Cuisine` (sans espace), puis
> recopie l'APK dans `fichiers-installation\`. Pour un build manuel, faites
> de même : copiez le projet hors chemin à espaces avant de lancer Gradle.

**b. Sur GitHub Actions (sans aucun compte Expo)** — workflow
`.github/workflows/build-android-apk.yml` : onglet *Actions → Android APK
(build direct) → Run workflow*. L'APK sort dans les artefacts du run, et
est joint à la release si le déclenchement est un tag `v*`.

**c. Via EAS Build (compte Expo)** — comme le job `android` de
`release.yml` :

```bash
npx eas-cli build --platform android --profile preview   # APK
npx eas-cli build --platform android --profile production # AAB Play Store
```

Nécessite `eas init` et les secrets `EXPO_TOKEN` + `EAS_PROJECT_ID`.

### Publier sur le Play Store (optionnel)
1. Créer un vrai keystore :
   `keytool -genkeypair -v -keystore 123cuisine.keystore -alias 123cuisine -keyalg RSA -keysize 2048 -validity 10000`
2. Renseigner `signingConfigs` dans `android/app/build.gradle` (ou via les
   variables Gradle) au lieu du `debug.keystore` par défaut.
3. Construire un **AAB** : `gradlew bundleRelease` (profil `production` EAS).

---

## 3. 🍎 iOS

La construction iOS **exige l'outillage Apple** (Xcode sous macOS) : elle ne
peut pas se faire depuis Windows. Deux chemins :

### a. EAS Build (recommandé sans Mac)
1. Compte **Apple Developer** (99 $/an) : https://developer.apple.com
2. `npx eas-cli login` puis `npx eas init` (écrit l'`EAS_PROJECT_ID`).
3. Construire :
   ```bash
   npx eas-cli build --platform ios --profile production  # App Store
   npx eas-cli build --platform ios --profile preview     # appareils enregistrés
   ```
4. Soumettre : `npx eas-cli submit --platform ios`.

### b. Depuis un Mac
```bash
pnpm install
npx expo prebuild --platform ios
open ios/*.xcworkspace   # puis Product ▸ Archive dans Xcode
```

### Alternative sans compte Apple : la PWA
Sur iPhone/iPad, ouvrir l'adresse web (GitHub Pages) dans Safari puis
*Partager ▸ Sur l'écran d'accueil* : l'application s'instelle comme une
vraie appli (plein écran, icône — voir `public/manifest.json`), sans
App Store. Même astuce sur Android (Chrome ▸ *Installer l'application*).

---

## 4. 🐧 Linux / 🍝 macOS

Les installeurs **ne peuvent pas se construire depuis Windows** (AppImage
exige des liens symboliques POSIX, DMG exige macOS). C'est le rôle du
workflow `release.yml` : pousser un tag `v*` (ex. `v1.2.8`) construit et
publie automatiquement sur la release GitHub :
- `123Cuisine.AppImage` (Linux — `chmod +x` puis double-clic),
- `123Cuisine.dmg` + `123Cuisine.zip` (macOS, Intel + Apple Silicon).

Depuis un poste Linux ou macOS, le build local est possible :
```bash
pnpm install && pnpm run build:web && npx electron-builder --linux   # ou --mac
```

---

## 5. 🌐 Web / PWA

```bash
pnpm install
pnpm run build:web        # exporte le site statique dans dist/
npx serve dist            # prévisualisation locale
```

Le déploiement vers **GitHub Pages** est automatique à chaque push sur
`main` (workflow `deploy-web.yml`, URL `https://catelyn2332-design.github.io/123Cuisine/`).

---

## 6. 🔧 Installation de développement (n'importe quel OS)

```bash
corepack enable pnpm          # active pnpm (version épinglée dans package.json)
pnpm install                  # dépendances
pnpm run verify               # config Supabase + types + lint
pnpm start                    # Metro (qrcode Expo Go pour tester sur mobile)
pnpm run electron:dev         # test de la version bureau
```

`.env` doit contenir la configuration du projet Supabase (le script
`check-supabase-env.mjs` refuse de construire si elle change, cf. panne 1.2.4) :
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

---

## 7. 🚀 Résumé : publier une nouvelle version sur toutes les plateformes

1. Mettre à jour `version` dans `package.json` **et** `app.config.js`.
2. `git tag v1.x.y && git push origin v1.x.y` :
   - `release.yml` construit Windows + Linux + macOS et les publie sur la
     release GitHub, puis l'APK via EAS (si `EXPO_TOKEN` configuré) ;
   - `build-android-apk.yml` joint aussi l'APK construit par Gradle
     (fonctionne sans compte Expo).
3. `deploy-web.yml` met à jour le site à chaque push sur `main`.
4. Pour iOS : `npx eas-cli build --platform ios` + `submit`.
