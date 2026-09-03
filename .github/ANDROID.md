# 📱 APK Android — mise en service

Comment l'APK de 123Cuisine est fabriqué, signé et publié, et ce qu'il reste à
faire une seule fois pour que ça démarre.

## 1. Ce qui se passe automatiquement

Le workflow [`release.yml`](workflows/release.yml) contient trois jobs Android :

| Job | Rôle |
|---|---|
| `android-build` | Régénère le projet natif (`expo prebuild`), compile avec Gradle, vérifie la signature, dépose `123Cuisine.apk` en artefact du workflow |
| `android-eas` | Filet de secours : ne s'exécute **que** si `android-build` a échoué, et seulement si un compte Expo est branché |
| `android-publish` | Sur un tag `v*` uniquement : joint l'APK à la release GitHub, à côté des installeurs bureau |

Le dossier `android/` n'est jamais dans le dépôt : c'est du code généré à partir
d'[`app.config.js`](../app.config.js) à chaque construction.

## 2. Les secrets à créer (une seule fois)

Dépôt → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Le fichier `123cuisine-release.jks` encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `123cuisine` |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé (identique au précédent) |

### Vérifier qu'ils sont bons

Un secret GitHub ne se relit pas : une fois enregistré, personne — pas même
toi — ne peut vérifier ce qu'il contient. Une faute de copier-coller ne se voit
donc nulle part. C'est pourquoi `android-build` éprouve les quatre secrets en
quelques secondes, avant de lancer Gradle : il décode le base64, ouvre le
keystore avec le mot de passe, y cherche l'alias, puis affiche l'empreinte
SHA-256 du certificat. Chaque échec possible a son propre message.

Cette empreinte doit être identique à celle du keystore local :

```bash
keytool -list -v -keystore 123cuisine-release.jks | grep SHA256
```

Piège le plus fréquent : `base64` sans `-w0` découpe la sortie en lignes de 76
caractères. Le workflow retire désormais les espaces et retours à la ligne avant
de décoder, donc les deux formes passent — mais la valeur doit rester le contenu
**encodé**, pas le nom du fichier ni le chemin.

Tant que `ANDROID_KEYSTORE_BASE64` est absent, `android-build` s'arrête avec un
message clair — volontairement, plutôt que de produire un APK signé avec la clé
de débogage du gabarit React Native, qui s'installe mais ne peut jamais être mis
à jour proprement.

### ⚠️ Le keystore est irremplaçable

Android n'accepte une mise à jour que si elle porte **exactement la même
signature** que la version installée. Perdre `123cuisine-release.jks`, c'est ne
plus jamais pouvoir mettre à jour l'application : il faudrait la désinstaller et
la réinstaller, en perdant ses données locales.

Le fichier est exclu de git (`*.jks` dans `.gitignore`) et ne doit jamais y
entrer. À sauvegarder ailleurs : gestionnaire de mots de passe, clé USB, disque
personnel.

Le régénérer (uniquement si on repart de zéro) :

```bash
keytool -genkeypair -v -keystore 123cuisine-release.jks \
  -alias 123cuisine -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=123Cuisine, O=123Cuisine, C=FR"

base64 -w0 123cuisine-release.jks   # valeur à coller dans le secret
```

## 3. Obtenir un APK

**Pour tester, sans rien publier :**

```bash
gh workflow run "Release Desktop App" --ref main
gh run watch
```

Puis onglet Actions → l'exécution → section **Artifacts** → `123Cuisine-apk`.

**Pour publier :** poser un tag `v*` comme d'habitude. L'APK apparaît dans la
release GitHub à côté des installeurs Windows, macOS et Linux.

Sur le téléphone : autoriser l'installation depuis cette source, ouvrir le
fichier, installer. Le vrai test est la **connexion au compte** — les variables
`EXPO_PUBLIC_SUPABASE_*` sont figées dans le bundle au moment de la
construction, donc c'est la seule façon de vérifier que l'APK pointe sur le bon
backend.

## 4. Numéro de version

`android.versionCode` est calculé dans [`app.config.js`](../app.config.js) à
partir de `version` (`1.2.7` → `10207`). Il augmente donc tout seul à chaque
release, ce qu'Android exige pour accepter une mise à jour. Rien à faire à la
main, tant que les numéros mineur et correctif restent sous 100.

## 5. Le secours EAS (facultatif)

Si la compilation Gradle échoue, `android-eas` prend le relais — à condition que
les secrets `EXPO_TOKEN` et `EAS_PROJECT_ID` existent (compte Expo + `eas init`,
cf. [`eas.json`](../eas.json), profil `preview`). Sans eux, le job se saute avec
une simple note : c'est un filet, pas une dépendance.
